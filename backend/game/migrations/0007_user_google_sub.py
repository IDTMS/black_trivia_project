from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('game', '0006_match_invite_code_scores_and_open_slot'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='google_sub',
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
    ]
