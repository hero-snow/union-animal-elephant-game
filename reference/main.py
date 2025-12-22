import pygame
import pymunk
import pymunk.pygame_util
import random

# --- Constants ---
# Screen dimensions
WIDTH, HEIGHT = 600, 800
FPS = 60

# Colors
BACKGROUND_COLOR = (210, 230, 255)

# Physics properties
GRAVITY = (0.0, 900.0)

# Wall properties
WALL_INSET = 50
WALL_THICKNESS = 5
WALL_ELASTICITY = 0.5
WALL_FRICTION = 0.5

# Properties
MASS = 1
ELASTICITY = 0.8
FRICTION = 0.5
SPAWN_Y = 50

GAME_OVER_LINE_Y = 100  # ゲームオーバー判定ラインのY座標
GAME_OVER_DELAY = 2  # ゲームオーバーになるまでの猶予時間（秒）

# 動物の仕様を定義
# 進化の順番: ねずみ -> うさぎ -> ねこ -> いぬ -> きつね -> うま -> きりん -> ライオン -> 象
ANIMAL_SPECS = [
    {"name": "ねずみ", "radius": 20, "color": (128, 128, 128), "evolves_to": "うさぎ"},
    {"name": "うさぎ", "radius": 25, "color": (255, 255, 255), "evolves_to": "ねこ"},
    {"name": "ねこ", "radius": 30, "color": (255, 165, 0), "evolves_to": "いぬ"},
    {"name": "いぬ", "radius": 35, "color": (139, 69, 19), "evolves_to": "きつね"},
    {"name": "きつね", "radius": 40, "color": (255, 140, 0), "evolves_to": "うま"},
    {"name": "うま", "radius": 50, "color": (160, 82, 45), "evolves_to": "きりん"},
    {"name": "きりん", "radius": 60, "color": (255, 215, 0), "evolves_to": "ライオン"},
    {"name": "ライオン", "radius": 70, "color": (218, 165, 32), "evolves_to": "ぞう"},
    {
        "name": "ぞう",
        "radius": 80,
        "color": (192, 192, 192),
        "evolves_to": None,
    },  # 象は進化しない
]

# --- Initialization ---
pygame.init()
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Python Suika Game Base")
clock = pygame.time.Clock()
font_large = pygame.font.Font(None, 100)
font_small = pygame.font.Font(None, 50)

# --- Physics Space Setup ---
space = pymunk.Space()
space.gravity = GRAVITY

# Debug drawing tool
draw_options = pymunk.pygame_util.DrawOptions(screen)


# --- Wall Creation ---
def create_walls(space, width, height):
    """Creates static walls for the game area."""
    walls = [
        pymunk.Segment(
            space.static_body,
            (WALL_INSET, height - WALL_INSET),
            (width - WALL_INSET, height - WALL_INSET),
            WALL_THICKNESS,
        ),  # Floor
        pymunk.Segment(
            space.static_body,
            (WALL_INSET, height - WALL_INSET),
            (WALL_INSET, WALL_INSET),
            WALL_THICKNESS,
        ),  # Left wall
        pymunk.Segment(
            space.static_body,
            (width - WALL_INSET, height - WALL_INSET),
            (width - WALL_INSET, WALL_INSET),
            WALL_THICKNESS,
        ),  # Right wall
    ]
    for wall in walls:
        wall.elasticity = WALL_ELASTICITY
        wall.friction = WALL_FRICTION
    space.add(*walls)


# --- 動物を作る関数 ---
def create_animal(space, x, y, animal_spec):
    radius = animal_spec["radius"]
    moment = pymunk.moment_for_circle(MASS, 0, radius)
    body = pymunk.Body(MASS, moment)
    body.position = x, y
    shape = pymunk.Circle(body, radius)
    shape.elasticity = ELASTICITY
    shape.friction = FRICTION
    # カスタムプロパティとして動物の名前を追加
    shape.animal_name = animal_spec["name"]
    shape.collision_type = 1  # 動物用の衝突タイプ
    space.add(body, shape)
    return shape


# --- 衝突ハンドラ ---
# 衝突した動物を削除リストに追加するためのリスト
shapes_to_remove = []
# 進化後の動物を生成するためのリスト
animals_to_add = []


def post_solve_collision(arbiter, space, data):
    global score
    # 衝突した2つのシェイプを取得
    shape_a, shape_b = arbiter.shapes

    # 両方が動物であることを確認
    if hasattr(shape_a, "animal_name") and hasattr(shape_b, "animal_name"):
        # 同じ種類の動物か確認
        if shape_a.animal_name == shape_b.animal_name:
            # すでに削除リストに入っている場合は処理しない
            if shape_a in shapes_to_remove or shape_b in shapes_to_remove:
                return

            # 進化しない最終形態（象）でないことを確認
            spec_a = get_animal_spec(shape_a.animal_name)
            if spec_a and spec_a["evolves_to"]:
                # 2つの動物を削除リストに追加
                shapes_to_remove.append(shape_a)
                shapes_to_remove.append(shape_b)

                # 衝突位置（中間点）を計算
                pos_a = shape_a.body.position
                pos_b = shape_b.body.position
                collision_pos = (pos_a + pos_b) / 2

                # 進化後の動物の仕様を取得して、追加リストに追加
                evolved_spec = get_animal_spec(spec_a["evolves_to"])
                if evolved_spec:
                    animals_to_add.append(
                        (collision_pos.x, collision_pos.y, evolved_spec)
                    )
                    # スコアを加算
                    for i, spec in enumerate(ANIMAL_SPECS):
                        if spec["name"] == evolved_spec["name"]:
                            score += i * 10 + 10  # 進化後の動物に基づいてスコアを加算
                            break


# Pymunkに衝突ハンドラを登録
handler = space.on_collision(
    1, 1, post_solve=post_solve_collision
)  # 衝突タイプ1同士の衝突

# 壁を生成
create_walls(space, WIDTH, HEIGHT)

# --- ヘルパー ---
# 動物の名前から仕様を引くための辞書
ANIMAL_MAP = {spec["name"]: spec for spec in ANIMAL_SPECS}


def get_animal_spec(animal_name):
    return ANIMAL_MAP.get(animal_name)


# --- Main Game Loop ---
running = True
game_over = False
new_high_score = False
game_over_timer = 0
is_animal_over_line = False
score = 0
high_score = 0

# Load high score
try:
    with open("highscore.txt", "r") as f:
        high_score = int(f.read())
except (FileNotFoundError, ValueError):
    high_score = 0


# 最初に落とす動物を、最初の3種類からランダムに選ぶ
current_animal_spec = random.choice(ANIMAL_SPECS[:3])


def reset_game():
    """Resets the game to its initial state."""
    global \
        game_over, \
        game_over_timer, \
        is_animal_over_line, \
        current_animal_spec, \
        score, \
        new_high_score

    # Remove all animals from the space
    bodies_to_remove = [
        body for body in space.bodies if body.body_type == pymunk.Body.DYNAMIC
    ]
    for body in bodies_to_remove:
        space.remove(body, *body.shapes)

    # Clear collision handling lists
    shapes_to_remove.clear()
    animals_to_add.clear()

    # Reset game state variables
    game_over = False
    game_over_timer = 0
    is_animal_over_line = False
    new_high_score = False
    score = 0

    # Set a new starting animal
    current_animal_spec = random.choice(ANIMAL_SPECS[:3])


while running:
    # 1. Event Handling
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        # クリックしたらその場所に現在の動物を落とす (ゲームオーバーでない場合のみ)
        elif event.type == pygame.MOUSEBUTTONDOWN and not game_over:
            x, _ = event.pos
            radius = current_animal_spec["radius"]
            # 壁の外に出ないようにX座標を制限
            x = max(50 + radius, min(x, WIDTH - 50 - radius))

            create_animal(space, x, 50, current_animal_spec)  # Y=50から落とす

            # 次に落とす動物をランダムに選ぶ
            current_animal_spec = random.choice(ANIMAL_SPECS[:3])
        elif event.type == pygame.KEYDOWN and game_over:
            if event.key == pygame.K_r:
                reset_game()

    # 2. Physics Update
    space.step(1 / FPS)

    # 衝突後のオブジェクト削除と追加
    for shape in shapes_to_remove:
        if shape.body in space.bodies:
            space.remove(shape.body, shape)
    shapes_to_remove.clear()

    for x, y, spec in animals_to_add:
        create_animal(space, x, y, spec)
    animals_to_add.clear()

    # ゲームオーバー判定
    if not game_over:
        is_animal_over_line = False
        for body in space.bodies:
            # 動物の上端がラインを超えているかチェック
            shapes_list = list(body.shapes)

            if shapes_list:
                first_shape = shapes_list[0]
            if body.position.y - first_shape.radius < GAME_OVER_LINE_Y:
                is_animal_over_line = True
                break

        if is_animal_over_line:
            game_over_timer += 1 / FPS
            if game_over_timer > GAME_OVER_DELAY:
                game_over = True
                # ハイスコアを更新
                if score > high_score:
                    new_high_score = True
                    high_score = score
                    with open("highscore.txt", "w") as f:
                        f.write(str(high_score))
        else:
            game_over_timer = 0

    # 3. 描画
    screen.fill((BACKGROUND_COLOR))  # 背景色
    space.debug_draw(draw_options)  # Use Pymunk's debug drawing
    # ゲームオーバーラインの描画 (点線)
    for x in range(50, WIDTH - 50, 20):
        pygame.draw.line(
            screen, (255, 0, 0), (x, GAME_OVER_LINE_Y), (x + 10, GAME_OVER_LINE_Y), 2
        )

    # 壁の描画
    for wall in space.static_body.shapes:
        pygame.draw.line(screen, (100, 100, 100), wall.a, wall.b, 5)

    # 動物たち（円）の描画
    for body in space.bodies:
        for shape in body.shapes:
            if hasattr(shape, "animal_name"):
                spec = get_animal_spec(shape.animal_name)
                if spec:
                    pos = body.position
                    pygame.draw.circle(
                        screen, spec["color"], (int(pos.x), int(pos.y)), spec["radius"]
                    )

    # 次に落とす動物をマウスカーソルの位置に表示 (ゲームオーバーでない場合)
    if not game_over:
        mouse_x, _ = pygame.mouse.get_pos()
        radius = current_animal_spec["radius"]
        # X座標を壁の内側に制限
        indicator_x = max(50 + radius, min(mouse_x, WIDTH - 50 - radius))
        pygame.draw.circle(
            screen, current_animal_spec["color"], (indicator_x, 50), radius, 3
        )  # 枠線だけ描画

    # スコア表示
    score_text = font_small.render(f"Score: {score}", True, (0, 0, 0))
    screen.blit(score_text, (60, 20))

    # ハイスコア表示
    high_score_text = font_small.render(f"High Score: {high_score}", True, (0, 0, 0))
    high_score_rect = high_score_text.get_rect(right=WIDTH - 60, top=20)
    screen.blit(high_score_text, high_score_rect)

    # ゲームオーバー表示
    if game_over:
        text = font_large.render("Game Over", True, (200, 0, 0))
        text_rect = text.get_rect(center=(WIDTH / 2, HEIGHT / 2 - 40))
        screen.blit(text, text_rect)

        # Final score
        final_score_text = font_small.render(f"Score: {score}", True, (0, 0, 0))
        final_score_rect = final_score_text.get_rect(
            center=(WIDTH / 2, HEIGHT / 2 + 20)
        )
        screen.blit(final_score_text, final_score_rect)

        # Restart message
        restart_text = font_small.render("Press R to Restart", True, (0, 0, 0))
        restart_rect = restart_text.get_rect(center=(WIDTH / 2, HEIGHT / 2 + 70))
        screen.blit(restart_text, restart_rect)

        if new_high_score:
            new_high_score_text = font_small.render(
                "New High Score!", True, (255, 215, 0)
            )
            new_high_score_rect = new_high_score_text.get_rect(
                center=(WIDTH / 2, HEIGHT / 2 + 120)
            )
            screen.blit(new_high_score_text, new_high_score_rect)

    pygame.display.flip()
    clock.tick(FPS)

pygame.quit()
