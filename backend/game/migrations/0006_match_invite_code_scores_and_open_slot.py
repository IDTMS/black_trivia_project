from uuid import uuid4

from django.db import migrations, models


def populate_invite_codes(apps, schema_editor):
    Match = apps.get_model('game', 'Match')
    for match in Match.objects.filter(invite_code__isnull=True):
        invite_code = uuid4().hex[:6].upper()
        while Match.objects.filter(invite_code=invite_code).exists():
            invite_code = uuid4().hex[:6].upper()
        match.invite_code = invite_code
        match.save(update_fields=['invite_code'])


class Migration(migrations.Migration):

    dependencies = [
        ('game', '0005_question_difficulty_alter_question_category'),
    ]

    operations = [
        migrations.AddField(
            model_name='match',
            name='invite_code',
            field=models.CharField(blank=True, max_length=6, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='match',
            name='player1_score',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='match',
            name='player2_score',
            field=models.IntegerField(default=0),
        ),
        migrations.AlterField(
            model_name='match',
            name='player2',
            field=models.ForeignKey(blank=True, null=True, on_delete=models.deletion.CASCADE, related_name='matches_as_player2', to='game.user'),
        ),
        migrations.RunPython(populate_invite_codes, migrations.RunPython.noop),
    ]
