import logging
import requests
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import viewsets, status
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from .models import Movie
from .serializers import MovieSerializer
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from urllib.parse import quote

logger = logging.getLogger(__name__)


class MovieViewSet(viewsets.ModelViewSet):
    queryset = Movie.objects.all()
    serializer_class = MovieSerializer

    def list(self, request, *args, **kwargs):
        try:
            logger.info(
                f"GET /movies/ request received with query params: {request.query_params}, headers: {request.headers}"
            )
            refresh = request.query_params.get("refresh", "false").lower() == "true"
            movies = self.get_queryset()
            logger.info(f"Found {movies.count()} movies in database")

            if refresh or not movies.exists():
                logger.info("Fetching movies from TMDb")
                movies_data = []
                for page in range(1, 11):
                    url = "https://api.themoviedb.org/3/movie/popular"
                    params = {"api_key": settings.TMDB_API_KEY, "page": page}
                    response = requests.get(url, params=params)
                    response.raise_for_status()
                    tmdb_data = response.json().get("results", [])
                    logger.info(
                        f"Fetched {len(tmdb_data)} movies from TMDb page {page}"
                    )

                    movies_data.extend(
                        [
                            {
                                "title": movie["title"],
                                "genre": movie.get("genre_ids", [None])[0] or "Unknown",
                                "description": movie.get(
                                    "overview", "No description available."
                                ),
                                "rating": movie.get("vote_average"),
                                "year": int(movie.get("release_date", "")[:4])
                                if movie.get("release_date")
                                else None,
                                "poster_url": f"https://image.tmdb.org/t/p/w500{movie.get('poster_path', '')}"
                                if movie.get("poster_path")
                                else "/no-image.png",
                                "tmdb_id": str(movie["id"]),
                            }
                            for movie in tmdb_data
                        ]
                    )

                for data in movies_data:
                    Movie.objects.update_or_create(
                        tmdb_id=data["tmdb_id"],
                        defaults={
                            "title": data["title"],
                            "genre": data["genre"],
                            "description": data["description"],
                            "rating": data["rating"],
                            "year": data["year"],
                            "poster_url": data["poster_url"],
                        },
                    )
                logger.info(
                    f"Saved/Updated {len(movies_data)} movies from TMDb to database"
                )
                movies = Movie.objects.all()

            serializer = self.get_serializer(movies, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except requests.RequestException as e:
            logger.error(f"TMDb API error: {str(e)}")
            return Response(
                {"error": f"Failed to fetch movies from TMDb: {str(e)}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception as e:
            logger.error(f"Error in MovieViewSet.list: {str(e)}", exc_info=True)
            return Response(
                {"error": f"Internal server error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


def get_collaborative_recommendations(movie_id, limit, target_movie):
    session = requests.Session()
    retries = Retry(total=5, backoff_factor=1, status_forcelist=[502, 503, 504, 429])
    session.mount("https://", HTTPAdapter(max_retries=retries))
    try:
        if target_movie.tmdb_id:
            tmdb_id = target_movie.tmdb_id
            logger.info(f"Using TMDb ID from database: {tmdb_id}")
        else:
            tmdb_search_url = (
                f"https://api.themoviedb.org/3/search/movie?api_key={settings.TMDB_API_KEY}"
                f"&query={quote(target_movie.title)}&language=en-US"
            )
            logger.info(f"TMDb search URL: {tmdb_search_url}")
            tmdb_search_response = session.get(tmdb_search_url, timeout=15)
            logger.info(
                f"TMDb search response status: {tmdb_search_response.status_code}"
            )
            tmdb_search_response.raise_for_status()
            tmdb_results = tmdb_search_response.json().get("results", [])
            logger.info(
                f"TMDb search results for {target_movie.title}: {len(tmdb_results)} found"
            )

            if not tmdb_results:
                logger.warning(f"No TMDb match for {target_movie.title}")
                return [], Response(
                    {
                        "error": f"No TMDb match found for '{target_movie.title}'. Try refreshing the movie database."
                    },
                    status=404,
                )
            tmdb_id = str(tmdb_results[0]["id"])
            logger.info(f"TMDb ID for {target_movie.title}: {tmdb_id}")
            target_movie.tmdb_id = tmdb_id
            target_movie.save()

        tmdb_similar_url = (
            f"https://api.themoviedb.org/3/movie/{tmdb_id}/similar?api_key={settings.TMDB_API_KEY}"
            f"&language=en-US&page=1"
        )
        tmdb_similar_response = session.get(tmdb_similar_url, timeout=15)
        tmdb_similar_response.raise_for_status()
        tmdb_similar = tmdb_similar_response.json().get("results", [])
        logger.info(f"TMDb similar movies count: {len(tmdb_similar)}")
        logger.debug(
            f"TMDb similar movies: {[movie['title'] for movie in tmdb_similar]}"
        )

        recommendations = []
        for rank, movie in enumerate(tmdb_similar[:limit], 1):
            recommendations.append(
                {
                    "id": str(movie["id"]),  # Use TMDb ID as unique identifier
                    "title": movie["title"],
                    "tmdb_id": str(movie["id"]),
                    "genre": movie.get("genre_ids", [None])[0] or "Unknown",
                    "description": movie.get("overview", "No description available."),
                    "rating": movie.get("vote_average"),
                    "year": int(movie.get("release_date", "")[:4])
                    if movie.get("release_date")
                    else None,
                    "poster_url": f"https://image.tmdb.org/t/p/w500{movie.get('poster_path', '')}"
                    if movie.get("poster_path")
                    else "/no-image.png",
                    "recommendation_type": "collaborative",
                    "confidence_score": round((1.0 / rank) * 100, 2),
                    "tmdb_url": f"https://www.themoviedb.org/movie/{movie['id']}",
                }
            )
            logger.info(f"Added TMDb movie: {movie['title']} (ID: {movie['id']})")

        if not recommendations:
            logger.warning("No similar movies found on TMDb")
            return [], Response(
                {"error": "No similar movies found on TMDb for this movie."},
                status=404,
            )

        return recommendations, None

    except requests.exceptions.RequestException as e:
        logger.error(f"TMDb API error: {e}")
        return [], Response(
            {"error": f"TMDb API error: {str(e)}. Check your network or TMDb API key."},
            status=503,
        )
    finally:
        session.close()


@api_view(["GET"])
def recommended_movies(request):
    movie_id = request.query_params.get("id")
    limit = int(request.query_params.get("limit", 5))
    rec_type = request.query_params.get("type", "content")
    logger.info(f"Request received: id={movie_id}, limit={limit}, rec_type={rec_type}")

    if not movie_id:
        return Response({"error": "Movie ID is required"}, status=400)

    if rec_type not in ["content"]:
        return Response(
            {
                "error": "Invalid recommendation type. Use 'content' for content-based recommendations."
            },
            status=400,
        )

    try:
        movie_id = int(movie_id)
        logger.info(f"Converted movie_id: {movie_id}")

        try:
            target_movie = Movie.objects.get(id=movie_id)
            logger.info(
                f"Target movie: {movie_id}, title: {target_movie.title}, year: {target_movie.year}"
            )
        except Movie.DoesNotExist:
            return Response({"error": "Movie ID not found"}, status=404)

        movies = Movie.objects.all()
        logger.info(f"Found {movies.count()} movies")
        if not movies.exists():
            return Response({"error": "No movies in database"}, status=404)

        content_based_ids = []
        content_sim_scores = {}
        df = pd.DataFrame(
            list(movies.values("id", "title", "genre", "description", "year"))
        )
        logger.info(f"DataFrame shape: {df.shape}")

        df["combined"] = (
            df["genre"].astype(str).fillna("Unknown")
            + " "
            + df["description"].astype(str).fillna("No description available.")
        )
        logger.info(f"Combined column sample: {df['combined'].head().tolist()}")

        if df["combined"].str.strip().eq("").all():
            logger.warning(
                "No valid genre or description data for content-based recommendations"
            )
            return Response(
                {"error": "Not enough data for content-based recommendations"},
                status=400,
            )

        if len(df) < 2:
            return Response(
                {"error": "Need at least two movies for recommendations"},
                status=400,
            )

        tfidf = TfidfVectorizer(stop_words="english")
        tfidf_matrix = tfidf.fit_transform(df["combined"])
        logger.info(f"TF-IDF matrix shape: {tfidf_matrix.shape}")

        cosine_sim = cosine_similarity(tfidf_matrix, tfidf_matrix)
        logger.info(f"Cosine similarity shape: {cosine_sim.shape}")

        idx_list = df.index[df["id"] == movie_id].tolist()
        logger.info(f"Index for movie_id={movie_id}: {idx_list}")
        if not idx_list:
            return Response({"error": "Movie ID not found"}, status=404)
        idx = idx_list[0]

        sim_scores = list(enumerate(cosine_sim[idx]))
        sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
        top_indices = [i for i, score in sim_scores[1 : limit + 1]]
        content_based_ids = df.iloc[top_indices]["id"].tolist()
        content_sim_scores = {df.iloc[i]["id"]: score for i, score in sim_scores[1:]}
        logger.info(f"Content-based IDs: {content_based_ids}")

        final_ids = content_based_ids
        final_scores = content_sim_scores
        final_types = {id_: "content" for id_ in final_ids}

        logger.info(f"Final recommended IDs: {final_ids}")

        recommended_movies = Movie.objects.filter(id__in=final_ids)
        logger.info(f"Found {recommended_movies.count()} recommended movies")

        ordered_recommendations = []
        recommended_movies_dict = {movie.id: movie for movie in recommended_movies}
        for id_ in final_ids:
            if id_ in recommended_movies_dict:
                movie = recommended_movies_dict[id_]
                movie.recommendation_type = final_types.get(id_, "unknown")
                movie.confidence_score = round(final_scores.get(id_, 0) * 100, 2)
                movie.tmdb_url = (
                    f"https://www.themoviedb.org/movie/{movie.tmdb_id}"
                    if movie.tmdb_id
                    else "#"
                )
                ordered_recommendations.append(movie)
        logger.info(f"Ordered recommendations count: {len(ordered_recommendations)}")

        if not ordered_recommendations:
            return Response({"error": "No valid recommendations found"}, status=404)

        serializer = MovieSerializer(ordered_recommendations, many=True)
        return Response(serializer.data)

    except Exception as e:
        logger.error("Error in recommended_movies", exc_info=True)
        return Response({"error": f"Internal server error: {str(e)}"}, status=500)


@api_view(["GET"])
def collaborative_recommended_movies(request):
    movie_id = request.query_params.get("id")
    limit = int(request.query_params.get("limit", 5))
    logger.info(f"Collaborative request received: id={movie_id}, limit={limit}")

    if not movie_id:
        return Response({"error": "Movie ID is required"}, status=400)

    try:
        movie_id = int(movie_id)
        logger.info(f"Converted movie_id: {movie_id}")

        try:
            target_movie = Movie.objects.get(id=movie_id)
            logger.info(
                f"Target movie: {movie_id}, title: {target_movie.title}, year: {target_movie.year}, tmdb_id: {target_movie.tmdb_id}"
            )
        except Movie.DoesNotExist:
            return Response({"error": "Movie ID not found"}, status=404)

        recommendations, error_response = get_collaborative_recommendations(
            movie_id, limit, target_movie
        )
        if error_response:
            return error_response

        if not recommendations:
            return Response(
                {"error": "No collaborative recommendations found on TMDb."},
                status=404,
            )

        logger.info(f"Returning {len(recommendations)} TMDb recommendations")
        return Response(recommendations)

    except Exception as e:
        logger.error("Error in collaborative_recommended_movies", exc_info=True)
        return Response({"error": f"Internal server error: {str(e)}"}, status=500)
