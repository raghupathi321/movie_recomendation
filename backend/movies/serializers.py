from rest_framework import serializers
from .models import Movie


class MovieSerializer(serializers.ModelSerializer):
    recommendation_type = serializers.CharField(max_length=50, required=False)
    confidence_score = serializers.FloatField(required=False)

    class Meta:
        model = Movie
        fields = [
            "id",
            "title",
            "genre",
            "description",
            "rating",
            "year",
            "poster_url",
            "recommendation_type",
            "confidence_score",
        ]
