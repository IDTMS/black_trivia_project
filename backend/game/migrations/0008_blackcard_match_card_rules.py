from django.db import migrations, models


def create_black_cards(apps, schema_editor):
    User = apps.get_model('game', 'User')
    BlackCard = apps.get_model('game', 'BlackCard')

    for user in User.objects.all():
        BlackCard.objects.get_or_create(
            owner=user,
            defaults={'current_holder': user},
        )


class Migration(migrations.Migration):

    dependencies = [
        ('game', '0007_user_google_sub'),
    ]

    operations = [
        migrations.AddField(
            model_name='match',
            name='card_saved',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='match',
            name='final_question_active',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='match',
            name='final_question_player',
            field=models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, related_name='final_question_matches', to='game.user'),
        ),
        migrations.AddField(
            model_name='match',
            name='locked_out_player',
            field=models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, related_name='locked_out_matches', to='game.user'),
        ),
        migrations.AddField(
            model_name='match',
            name='required_opponent',
            field=models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, related_name='required_opponent_matches', to='game.user'),
        ),
        migrations.CreateModel(
            name='BlackCard',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('captured_at', models.DateTimeField(blank=True, null=True)),
                ('current_holder', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='wallet_black_cards', to='game.user')),
                ('owner', models.OneToOneField(on_delete=models.deletion.CASCADE, related_name='owned_black_card', to='game.user')),
            ],
        ),
        migrations.RunPython(create_black_cards, migrations.RunPython.noop),
    ]
