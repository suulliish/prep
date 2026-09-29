# Авторы готовых моделей

Все паки распространяются по лицензии **CC0 1.0** (общественное достояние): их можно использовать в публичной игре, указывать автора необязательно.
Мы указываем его из уважения. Лицензия каждого пака проверена по странице пака и по `License.txt` внутри архива (30.09.2026).
Исходники в репозиторий не входят; в `public/models` лежат только отобранные и сжатые модели (`scripts/assets/`).
Звуковые паки (Kenney, CC0) тоже не входят целиком: в `public/sfx` лежат 21 короткий mp3 (моно, 44,1 кГц, около 150 КБ всего), склеенные и подрезанные из этих паков: слои, сдвиг высоты и нормализация громкости. Названия файлов = названия звуков из `src/lib/audio.ts`; пока файл не загрузился, звук синтезируется кодом.

| Пак | Автор | Ссылка | Папка в `ASSET_SRC` | Где используется |
|---|---|---|---|---|
| Adventurers 2.0 FREE | Kay Lousberg (KayKit) | https://kaylousberg.itch.io/kaykit-adventurers | `chars`, `items` | 6 героев и оружие |
| Character Animations 1.1 (Free) | Kay Lousberg | https://kaylousberg.itch.io/kaykit-character-animations | `anims` | бой, ходьба, радость |
| Medieval Hexagon Pack FREE | Kay Lousberg | https://kaylousberg.itch.io/kaykit-medieval-hexagon | `hex` | плитки островов, дома, горы, облака |
| Forest Nature Pack FREE | Kay Lousberg | https://kaylousberg.itch.io/kaykit-forest | `forest` | деревья, камни, кусты, трава |
| Ultimate Monsters | Quaternius | https://quaternius.com/packs/ultimatemonsters.html | `monsters` | 50 монстров |
| Pirate Kit | Kenney | https://kenney.nl/assets/pirate-kit | `pirate` | сундук, бочки, пушка, обломки корабля, руины |
| Nature Kit 2.1 | Kenney | https://kenney.nl/assets/nature-kit | `jw-nature`, `ozh-nature-kit`, `nature-*` | миры 1, 2, 3, 7, 8, 9 |
| Modular Cave Kit 1.0 | Kenney | https://kenney.nl/assets/modular-cave-kit | `jw-cave`, `cave-purple` | мир 3 |
| Tower Defense Kit 2.1 | Kenney | https://kenney.nl/assets/tower-defense-kit | `tower-defense-kit` | мир 10 |
| Mini Arena 1.1 | Kenney, Tony Schär | https://kenney.nl/assets/mini-arena | `mini-arena` | мир 11 |
| Castle Kit 2.0 | Kenney | https://kenney.nl/assets/castle-kit | `castle-kit` | мир 11 |
| City Kit (Commercial) | Kenney | https://kenney.nl/assets/city-kit-commercial | `kenney-city-kit-commercial` | мир 4 |
| City Kit (Roads) | Kenney | https://kenney.nl/assets/city-kit-roads | `kenney-city-kit-roads` | мир 4 |
| Racing Kit | Kenney | https://kenney.nl/assets/racing-kit | `kenney-racing-kit` | мир 5 |
| Hexagon Kit | Kenney | https://kenney.nl/assets/hexagon-kit | `kenney-hexagon-snow` (копия с текстурой снега) | мир 6 |
| Holiday Kit | Kenney | https://kenney.nl/assets/holiday-kit | `kenney-holiday-kit` | мир 6 |
| Graveyard Kit 5.0 | Kenney | https://kenney.nl/assets/graveyard-kit | `ozh-graveyard-kit` | миры 7, 8 |
| Survival Kit 2.0 | Kenney | https://kenney.nl/assets/survival-kit | `ozh-survival-kit` | миры 8, 9 |
| Food Kit 2.0 | Kenney | https://kenney.nl/assets/food-kit | `ozh-food-kit` | мир 9 |
| Furniture Kit 2.0 | Kenney | https://kenney.nl/assets/furniture-kit | `ozh-furniture-kit` | мир 9 |
| Interface Sounds | Kenney | https://kenney.nl/assets/interface-sounds | `kenney-interface-sounds` | звуки: правильно, неправильно, подсказка, комбо, опыт, уровень, кристалл, сундук |
| UI Audio | Kenney | https://kenney.nl/assets/ui-audio | `kenney-ui-audio` | звук: нажатие кнопки |
| Impact Sounds | Kenney | https://kenney.nl/assets/impact-sounds | `kenney-impact-sounds` | звуки боя: удар, крит, попадание, щит, гул, приземление |
| RPG Audio | Kenney | https://kenney.nl/assets/rpg-audio | `kenney-rpg-audio` | звуки: взмах, сундук, монеты, портал, рык |
| Digital Audio | Kenney | https://kenney.nl/assets/digital-audio | `kenney-digital-audio` | звуки: энергия, портал, рык |
| Music Jingles | Kenney | https://kenney.nl/assets/music-jingles | `kenney-music-jingles` | звук: начало миссии |

Nature Kit и Modular Cave Kit перекрашены под миры скриптом `scripts/assets/recolor-nature.mjs`; снежная копия Hexagon Kit получена подменой текстуры. Модели не менялись иначе.

Не используем: Quaternius Bestiary (лицензия QAL запрещает раздавать файлы), музыку и модели с обязательным указанием автора (CC-BY).
