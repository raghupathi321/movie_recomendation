from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MovieViewSet, recommended_movies, collaborative_recommended_movies

router = DefaultRouter()
router.register(r"movies", MovieViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("recommended/", recommended_movies, name="recommended_movies"),
    path(
        "collaborative_recommended/",
        collaborative_recommended_movies,
        name="collaborative_recommended_movies",
    ),
]
