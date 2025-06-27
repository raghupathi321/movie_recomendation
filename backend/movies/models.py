# your_app/models.py
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class Movie(models.Model):
    title = models.CharField(max_length=100, unique=True)
    genre = models.CharField(max_length=50)
    description = models.TextField()
    rating = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(10.0)]
    )
    poster_url = models.URLField()
    year = models.PositiveIntegerField(null=True, blank=True)
    tmdb_id = models.CharField(
        max_length=20, unique=True, null=True, blank=True
    )  # New field

    def __str__(self):
        return self.title
