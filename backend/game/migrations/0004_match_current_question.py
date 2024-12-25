# Generated by Django 5.1.4 on 2024-12-25 01:11

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('game', '0003_match_current_buzzer_alter_match_loser_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='match',
            name='current_question',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='current_question', to='game.question'),
        ),
    ]
