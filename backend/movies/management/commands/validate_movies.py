from django.core.management.base import BaseCommand
from movies.models import Movie


class Command(BaseCommand):
    help = "Validate and fix movie data"

    def handle(self, *args, **kwargs):
        movies = Movie.objects.all()
        self.stdout.write(self.style.SUCCESS(f"Found {movies.count()} movies"))
        for movie in movies:
            issues = []
            if not movie.id:
                issues.append("Missing ID")
            if not movie.title:
                issues.append("Missing title")
            if not movie.genre:
                movie.genre = "Unknown"
                issues.append("Missing genre (set to 'Unknown')")
            if not movie.description:
                movie.description = "No description available."
                issues.append("Missing description (set to default)")
            if issues:
                self.stdout.write(
                    self.style.WARNING(
                        f"Movie ID={movie.id}, Title={movie.title}: {', '.join(issues)}"
                    )
                )
                movie.save()
            else:
                self.stdout.write(
                    self.style.SUCCESS(f"Movie ID={movie.id}, Title={movie.title}: OK")
                )
        if movies.count() < 2:
            self.stdout.write(
                self.style.ERROR(
                    "Fewer than 2 movies in database. Recommendations may fail."
                )
            )
