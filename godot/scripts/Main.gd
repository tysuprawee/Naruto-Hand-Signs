extends Control

enum AppScreen {
	MENU,
	PLAY,
}

const DEFAULT_WS_URL: String = "ws://127.0.0.1:8765"
const DEFAULT_BACKEND_HOST: String = "127.0.0.1"
const DEFAULT_BACKEND_PORT: int = 8765

const AUTO_CONNECT_ON_READY: bool = false
const AUTO_START_BACKEND_ON_FAILURE: bool = true
const BACKEND_CONNECT_RETRY_DELAY_S: float = 1.5
const BACKEND_CONNECT_TIMEOUT_S: float = 5.0
const BACKEND_SIDECAR_REL_PATH: String = "backend/backend_server_mediapipe.exe"

const BG_TEXTURE_PATH: String = "res://assets/pics/fea2.png"
const LOGO_TEXTURE_PATH: String = "res://assets/pics/logo2.png"
const STEP_SFX_PATH: String = "res://assets/sounds/each.mp3"
const COMPLETE_SFX_PATH: String = "res://assets/sounds/complete.mp3"
const UNSUPPORTED_VIDEO_FORMAT_TEXT: String = "MP4 preview unsupported in this Godot build."

const JUTSU_SEQUENCES: Dictionary = {
	"Fireball": ["horse", "snake", "ram", "monkey", "boar", "horse", "tiger"],
	"Water Dragon": ["ox", "monkey", "hare", "rat", "boar", "bird", "ox", "horse", "bird"],
	"Chidori": ["ox", "hare", "monkey"],
	"Shadow Clone": ["ram", "snake", "tiger"],
	"Rasengan": ["ram"],
}

const SIGN_IMAGE_BY_LABEL: Dictionary = {
	"bird": "res://assets/pics/png/bird.png",
	"boar": "res://assets/pics/png/boar.png",
	"clap": "res://assets/pics/png/clap.png",
	"dog": "res://assets/pics/png/dog.png",
	"dragon": "res://assets/pics/png/dragon.png",
	"hare": "res://assets/pics/png/hare.png",
	"horse": "res://assets/pics/png/horse.png",
	"monkey": "res://assets/pics/png/monkey.png",
	"ox": "res://assets/pics/png/ox.png",
	"ram": "res://assets/pics/png/ram.png",
	"rat": "res://assets/pics/png/rat.png",
	"snake": "res://assets/pics/png/snake.png",
	"tiger": "res://assets/pics/png/tiger.png",
}

const JUTSU_VIDEO_BY_NAME: Dictionary = {
	"Chidori": "res://assets/videos/chidori.mp4",
	"Rasengan": "res://assets/videos/rasengan.mp4",
}

@onready var background_rect: TextureRect = $Background
@onready var menu_root: CenterContainer = $MenuRoot
@onready var menu_logo: TextureRect = $MenuRoot/MenuPanel/MenuVBox/MenuLogo
@onready var menu_subtitle: Label = $MenuRoot/MenuPanel/MenuVBox/MenuSubtitle
@onready var menu_status: Label = $MenuRoot/MenuPanel/MenuVBox/MenuStatus
@onready var btn_play: Button = $MenuRoot/MenuPanel/MenuVBox/MenuButtons/BtnPlay
@onready var btn_quit: Button = $MenuRoot/MenuPanel/MenuVBox/MenuButtons/BtnQuit

@onready var game_root: Control = $GameRoot
@onready var btn_back_to_menu: Button = $GameRoot/TopBar/TopBarHBox/BtnBackToMenu
@onready var backend_state_label: Label = $GameRoot/TopBar/TopBarHBox/BackendStateLabel
@onready var camera_view: TextureRect = $GameRoot/Body/CameraPanel/CameraVBox/CameraView
@onready var camera_status_label: Label = $GameRoot/Body/CameraPanel/CameraVBox/CameraStatusLabel
@onready var sequence_status_label: Label = $GameRoot/Body/CameraPanel/CameraVBox/SequencePanel/SequenceVBox/SequenceHeader/SequenceStatus
@onready var sequence_strip: HBoxContainer = $GameRoot/Body/CameraPanel/CameraVBox/SequencePanel/SequenceVBox/SequenceScroll/SequenceStrip

@onready var url_edit: LineEdit = $GameRoot/Body/HudPanel/HudScroll/HudVBox/UrlEdit
@onready var btn_connect: Button = $GameRoot/Body/HudPanel/HudScroll/HudVBox/BtnConnect
@onready var toggle_send_frames: CheckBox = $GameRoot/Body/HudPanel/HudScroll/HudVBox/ToggleSendFrames
@onready var toggle_two_hands: CheckBox = $GameRoot/Body/HudPanel/HudScroll/HudVBox/ToggleTwoHands
@onready var toggle_skeletons: CheckBox = $GameRoot/Body/HudPanel/HudScroll/HudVBox/ToggleSkeletons
@onready var quality_value_label: Label = $GameRoot/Body/HudPanel/HudScroll/HudVBox/QualityRow/QualityValue
@onready var quality_slider: HSlider = $GameRoot/Body/HudPanel/HudScroll/HudVBox/QualitySlider
@onready var fps_value_label: Label = $GameRoot/Body/HudPanel/HudScroll/HudVBox/TargetFpsRow/TargetFpsValue
@onready var fps_slider: HSlider = $GameRoot/Body/HudPanel/HudScroll/HudVBox/TargetFpsSlider
@onready var toggle_game_mechanic: CheckBox = $GameRoot/Body/HudPanel/HudScroll/HudVBox/ToggleGameMechanic
@onready var jutsu_select: OptionButton = $GameRoot/Body/HudPanel/HudScroll/HudVBox/JutsuSelect
@onready var btn_reset_run: Button = $GameRoot/Body/HudPanel/HudScroll/HudVBox/BtnResetRun
@onready var sign_preview: TextureRect = $GameRoot/Body/HudPanel/HudScroll/HudVBox/SignPreviewPanel/SignPreviewVBox/SignPreview
@onready var sign_name_label: Label = $GameRoot/Body/HudPanel/HudScroll/HudVBox/SignPreviewPanel/SignPreviewVBox/SignNameLabel
@onready var video_preview: VideoStreamPlayer = $GameRoot/Body/HudPanel/HudScroll/HudVBox/VideoPreviewPanel/VideoPreviewVBox/VideoPreview
@onready var video_hint_label: Label = $GameRoot/Body/HudPanel/HudScroll/HudVBox/VideoPreviewPanel/VideoPreviewVBox/VideoHintLabel
@onready var game_progress_label: Label = $GameRoot/Body/HudPanel/HudScroll/HudVBox/GameProgressLabel
@onready var metrics_label: Label = $GameRoot/Body/HudPanel/HudScroll/HudVBox/MetricsLabel

@onready var step_particles: CPUParticles2D = $GameRoot/StepParticles
@onready var complete_particles: CPUParticles2D = $GameRoot/CompleteParticles
@onready var sfx_step: AudioStreamPlayer = $GameRoot/StepSfx
@onready var sfx_complete: AudioStreamPlayer = $GameRoot/CompleteSfx

var current_screen: int = AppScreen.MENU

var socket: WebSocketPeer = WebSocketPeer.new()
var ws_url: String = DEFAULT_WS_URL
var is_connected: bool = false
var pending_connect: bool = false
var connecting_started_at_s: float = 0.0
var connect_timeout_s: float = BACKEND_CONNECT_TIMEOUT_S
var connect_retry_at_s: float = -1.0

var backend_host: String = DEFAULT_BACKEND_HOST
var backend_port: int = DEFAULT_BACKEND_PORT
var backend_pid: int = -1
var backend_started_by_app: bool = false
var backend_spawn_attempted: bool = false

var frame_texture: ImageTexture
var sign_textures: Dictionary = {}
var last_status_text: String = ""
var server_architecture: String = "unknown"

var latest_stable_sign: String = "idle"
var latest_stable_conf: float = 0.0
var latest_detection_fps: float = 0.0
var display_fps: float = 0.0
var display_frame_count: int = 0
var display_fps_start_s: float = 0.0

var game_current_jutsu: String = "Fireball"
var game_step: int = 0
var game_last_accept_s: float = 0.0
var game_run_start_s: float = 0.0
var game_step_cooldown_s: float = 0.35
var game_completions: int = 0
var game_best_time_s: float = 0.0
var sequence_card_nodes: Array = []
var sequence_icon_nodes: Array = []
var sequence_label_nodes: Array = []
var last_sequence_signature: String = ""
var last_sequence_step_visual: int = -9999
var last_sequence_enabled_visual: bool = true


func _ready() -> void:
	_wire_signals()
	_load_assets()
	_configure_particles()
	_populate_jutsu_select()
	_sync_controls()
	_show_screen(AppScreen.MENU)
	_set_status("Ready.")
	_set_backend_status("Backend: waiting")
	display_fps_start_s = _now_s()
	_update_game_progress_label()
	_refresh_video_preview()
	if AUTO_CONNECT_ON_READY:
		_connect_if_idle()


func _exit_tree() -> void:
	_shutdown_backend_if_owned()


func _process(_delta: float) -> void:
	_socket_tick()
	_process_connect_retry()
	_update_particle_positions()
	_update_game_progress_label()
	_update_menu_glow()


func _wire_signals() -> void:
	btn_play.pressed.connect(_on_play_pressed)
	btn_quit.pressed.connect(_on_quit_pressed)
	btn_back_to_menu.pressed.connect(_on_back_to_menu_pressed)
	btn_connect.pressed.connect(_on_connect_pressed)
	url_edit.text_submitted.connect(_on_url_submitted)
	toggle_send_frames.toggled.connect(_on_settings_changed)
	toggle_two_hands.toggled.connect(_on_settings_changed)
	toggle_skeletons.toggled.connect(_on_settings_changed)
	quality_slider.value_changed.connect(_on_settings_changed)
	fps_slider.value_changed.connect(_on_settings_changed)
	toggle_game_mechanic.toggled.connect(_on_game_mode_toggled)
	jutsu_select.item_selected.connect(_on_jutsu_selected)
	btn_reset_run.pressed.connect(_on_reset_run_pressed)


func _load_assets() -> void:
	ws_url = DEFAULT_WS_URL
	url_edit.text = ws_url

	background_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	menu_logo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	menu_logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	camera_view.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	camera_view.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	sign_preview.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	sign_preview.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	video_preview.visible = false
	video_hint_label.text = "No video loaded."
	sign_name_label.text = "NEXT: --"

	var bg_tex: Texture2D = _load_texture(BG_TEXTURE_PATH)
	if bg_tex != null:
		background_rect.texture = bg_tex

	var logo_tex: Texture2D = _load_texture(LOGO_TEXTURE_PATH)
	if logo_tex != null:
		menu_logo.texture = logo_tex

	var sign_keys: Array = SIGN_IMAGE_BY_LABEL.keys()
	for idx: int in range(sign_keys.size()):
		var sign_key: String = str(sign_keys[idx]).to_lower()
		var path_variant: Variant = SIGN_IMAGE_BY_LABEL.get(sign_key, "")
		var image_path: String = str(path_variant)
		var tex: Texture2D = _load_texture(image_path)
		if tex != null:
			sign_textures[sign_key] = tex

	var step_stream: AudioStream = _load_audio_stream(STEP_SFX_PATH)
	if step_stream != null:
		sfx_step.stream = step_stream

	var complete_stream: AudioStream = _load_audio_stream(COMPLETE_SFX_PATH)
	if complete_stream != null:
		sfx_complete.stream = complete_stream

	if sign_textures.has("horse"):
		var horse_variant: Variant = sign_textures.get("horse")
		if horse_variant is Texture2D:
			sign_preview.texture = horse_variant as Texture2D


func _load_texture(path: String) -> Texture2D:
	if path.is_empty():
		return null
	if not ResourceLoader.exists(path):
		return null
	var res: Resource = load(path)
	if res == null:
		return null
	if res is Texture2D:
		return res as Texture2D
	return null


func _load_audio_stream(path: String) -> AudioStream:
	if path.is_empty():
		return null
	if not ResourceLoader.exists(path):
		return null
	var res: Resource = load(path)
	if res == null:
		return null
	if res is AudioStream:
		return res as AudioStream
	return null


func _configure_particles() -> void:
	_configure_particle_node(step_particles, 60, 0.45, 120.0, 300.0, 0.5)
	step_particles.color = Color(1.0, 0.55, 0.15, 1.0)

	_configure_particle_node(complete_particles, 140, 0.8, 180.0, 420.0, 0.9)
	complete_particles.color = Color(1.0, 0.95, 0.35, 1.0)


func _configure_particle_node(node: CPUParticles2D, amount: int, life: float, vel_min: float, vel_max: float, scale_max: float) -> void:
	node.one_shot = true
	node.emitting = false
	node.amount = amount
	node.lifetime = life
	node.explosiveness = 0.95
	node.direction = Vector2(0.0, -1.0)
	node.spread = 180.0
	node.gravity = Vector2(0.0, 620.0)
	node.initial_velocity_min = vel_min
	node.initial_velocity_max = vel_max
	node.scale_amount_min = 0.12
	node.scale_amount_max = scale_max
	node.emission_shape = CPUParticles2D.EMISSION_SHAPE_SPHERE
	node.emission_sphere_radius = 24.0


func _update_particle_positions() -> void:
	if not game_root.visible:
		return
	var rect: Rect2 = camera_view.get_global_rect()
	var center: Vector2 = rect.position + rect.size * 0.5
	step_particles.global_position = center
	complete_particles.global_position = center


func _populate_jutsu_select() -> void:
	jutsu_select.clear()
	var keys: Array = JUTSU_SEQUENCES.keys()
	keys.sort()
	for idx: int in range(keys.size()):
		var key_name: String = str(keys[idx])
		jutsu_select.add_item(key_name)

	if jutsu_select.item_count > 0:
		for idx2: int in range(jutsu_select.item_count):
			if jutsu_select.get_item_text(idx2) == game_current_jutsu:
				jutsu_select.select(idx2)
				break


func _sync_controls() -> void:
	quality_slider.value = 45
	fps_slider.value = 24
	toggle_send_frames.button_pressed = true
	toggle_two_hands.button_pressed = true
	toggle_skeletons.button_pressed = false
	toggle_game_mechanic.button_pressed = true
	quality_value_label.text = str(int(quality_slider.value))
	fps_value_label.text = str(int(fps_slider.value))


func _show_screen(screen: int) -> void:
	current_screen = screen
	menu_root.visible = (screen == AppScreen.MENU)
	game_root.visible = (screen == AppScreen.PLAY)
	if screen == AppScreen.PLAY:
		_update_game_progress_label()
		_refresh_video_preview()
		_connect_if_idle()


func _on_play_pressed() -> void:
	_show_screen(AppScreen.PLAY)


func _on_back_to_menu_pressed() -> void:
	_show_screen(AppScreen.MENU)


func _on_quit_pressed() -> void:
	get_tree().quit()


func _update_menu_glow() -> void:
	if not menu_root.visible:
		return
	var pulse: float = 0.84 + 0.16 * sin(_now_s() * 1.6)
	menu_logo.modulate = Color(pulse, pulse, pulse, 1.0)


func _socket_tick() -> void:
	socket.poll()
	var state: int = socket.get_ready_state()

	if state == WebSocketPeer.STATE_OPEN:
		if not is_connected:
			is_connected = true
			pending_connect = false
			btn_connect.text = "Disconnect"
			_set_status("Connected to " + ws_url)
			_set_backend_status("Backend: online")
			_send_settings()

		while socket.get_available_packet_count() > 0:
			var packet_text: String = socket.get_packet().get_string_from_utf8()
			var payload: Variant = JSON.parse_string(packet_text)
			if typeof(payload) == TYPE_DICTIONARY:
				var data: Dictionary = payload
				_handle_server_message(data)

	elif state == WebSocketPeer.STATE_CONNECTING:
		if pending_connect:
			if _now_s() - connecting_started_at_s >= connect_timeout_s:
				socket.close()
				_on_connect_failure("Connection timeout.")

	else:
		if is_connected:
			is_connected = false
			pending_connect = false
			btn_connect.text = "Connect"
			_set_status("Disconnected.")
		elif pending_connect:
			socket.close()
			_on_connect_failure("Connection failed.")


func _on_connect_pressed() -> void:
	var state: int = socket.get_ready_state()
	if state == WebSocketPeer.STATE_OPEN or state == WebSocketPeer.STATE_CONNECTING:
		socket.close()
		pending_connect = false
		is_connected = false
		btn_connect.text = "Connect"
		_set_status("Disconnected.")
		return

	_connect_if_idle()


func _on_url_submitted(_text: String) -> void:
	_connect_if_idle()


func _connect_if_idle() -> void:
	var state: int = socket.get_ready_state()
	if state == WebSocketPeer.STATE_OPEN or state == WebSocketPeer.STATE_CONNECTING:
		return

	ws_url = url_edit.text.strip_edges()
	if ws_url.is_empty():
		ws_url = DEFAULT_WS_URL
		url_edit.text = ws_url

	_refresh_backend_target_from_url()
	socket = WebSocketPeer.new()
	var err: int = socket.connect_to_url(ws_url)
	if err != OK:
		_on_connect_failure("Connect failed: " + str(err))
		return

	connecting_started_at_s = _now_s()
	pending_connect = true
	btn_connect.text = "Disconnect"
	_set_status("Connecting to " + ws_url + " ...")


func _on_connect_failure(reason: String) -> void:
	pending_connect = false
	btn_connect.text = "Connect"
	_set_status(reason)
	if AUTO_START_BACKEND_ON_FAILURE and not backend_spawn_attempted:
		var started: bool = _start_backend_process()
		if started:
			_set_status("Backend started, retrying...")
			connect_retry_at_s = _now_s() + BACKEND_CONNECT_RETRY_DELAY_S


func _process_connect_retry() -> void:
	if connect_retry_at_s <= 0.0:
		return
	if _now_s() < connect_retry_at_s:
		return
	connect_retry_at_s = -1.0
	_connect_if_idle()


func _refresh_backend_target_from_url() -> void:
	var parsed: Dictionary = _parse_ws_url(ws_url)
	backend_host = str(parsed.get("host", DEFAULT_BACKEND_HOST))
	backend_port = int(parsed.get("port", DEFAULT_BACKEND_PORT))


func _parse_ws_url(url: String) -> Dictionary:
	var result: Dictionary = {
		"host": DEFAULT_BACKEND_HOST,
		"port": DEFAULT_BACKEND_PORT,
	}

	var clean: String = url.strip_edges()
	if clean.begins_with("ws://"):
		clean = clean.substr(5)
	elif clean.begins_with("wss://"):
		clean = clean.substr(6)

	var slash_idx: int = clean.find("/")
	if slash_idx >= 0:
		clean = clean.substr(0, slash_idx)

	if clean.is_empty():
		return result

	var host: String = clean
	var port: int = DEFAULT_BACKEND_PORT
	var colon_idx: int = clean.rfind(":")
	if colon_idx > 0 and colon_idx < clean.length() - 1:
		host = clean.substr(0, colon_idx)
		var port_str: String = clean.substr(colon_idx + 1)
		var parsed_port: int = int(port_str)
		if parsed_port > 0:
			port = parsed_port

	result["host"] = host
	result["port"] = port
	return result


func _start_backend_process() -> bool:
	backend_spawn_attempted = true
	_refresh_backend_target_from_url()

	var candidates: Array = _build_backend_launch_candidates()
	for idx: int in range(candidates.size()):
		var candidate_v: Variant = candidates[idx]
		if typeof(candidate_v) != TYPE_DICTIONARY:
			continue

		var candidate: Dictionary = candidate_v
		var bin_path: String = str(candidate.get("bin", ""))
		if bin_path.is_empty():
			continue

		var args: PackedStringArray = PackedStringArray()
		var args_v: Variant = candidate.get("args", PackedStringArray())
		if typeof(args_v) == TYPE_PACKED_STRING_ARRAY:
			args = args_v

		var pid: int = OS.create_process(bin_path, args, false)
		if pid > 0:
			backend_pid = pid
			backend_started_by_app = true
			var label: String = str(candidate.get("label", "backend"))
			_set_backend_status("Backend: started (" + label + "), pid=" + str(pid))
			return true

	_set_backend_status("Backend: auto-start unavailable")
	return false


func _build_backend_launch_candidates() -> Array:
	var candidates: Array = []

	var exec_dir: String = OS.get_executable_path().get_base_dir()
	if exec_dir.is_empty():
		exec_dir = ProjectSettings.globalize_path("res://")

	var sidecar_path: String = exec_dir.path_join(BACKEND_SIDECAR_REL_PATH)
	if FileAccess.file_exists(sidecar_path):
		candidates.append({
			"bin": sidecar_path,
			"args": PackedStringArray([
				"--host", backend_host,
				"--port", str(backend_port),
				"--camera", "0",
			]),
			"label": "sidecar exe",
		})

	var project_dir: String = ProjectSettings.globalize_path("res://")
	var dev_script_path: String = project_dir.path_join("../src/backend_server_mediapipe.py").simplify_path()
	if FileAccess.file_exists(dev_script_path):
		candidates.append({
			"bin": "python",
			"args": PackedStringArray([
				dev_script_path,
				"--host", backend_host,
				"--port", str(backend_port),
				"--camera", "0",
			]),
			"label": "python",
		})
		candidates.append({
			"bin": "python.exe",
			"args": PackedStringArray([
				dev_script_path,
				"--host", backend_host,
				"--port", str(backend_port),
				"--camera", "0",
			]),
			"label": "python.exe",
		})
		candidates.append({
			"bin": "py",
			"args": PackedStringArray([
				"-3",
				dev_script_path,
				"--host", backend_host,
				"--port", str(backend_port),
				"--camera", "0",
			]),
			"label": "py launcher",
		})

	return candidates


func _shutdown_backend_if_owned() -> void:
	if not backend_started_by_app:
		return
	if backend_pid <= 0:
		return
	var kill_err: int = OS.kill(backend_pid)
	if kill_err == OK:
		_set_backend_status("Backend: stopped")


func _set_status(text: String) -> void:
	if text == last_status_text:
		return
	last_status_text = text
	menu_status.text = text
	camera_status_label.text = text


func _set_backend_status(text: String) -> void:
	backend_state_label.text = text
	menu_subtitle.text = text


func _on_settings_changed(_value: Variant = null) -> void:
	quality_value_label.text = str(int(quality_slider.value))
	fps_value_label.text = str(int(fps_slider.value))
	_send_settings()


func _send_settings() -> void:
	if socket.get_ready_state() != WebSocketPeer.STATE_OPEN:
		return

	var payload: Dictionary = {
		"type": "settings",
		"send_frames": toggle_send_frames.button_pressed,
		"frame_quality": int(quality_slider.value),
		"target_fps": int(fps_slider.value),
		"send_landmarks": toggle_skeletons.button_pressed,
		"restricted_signs": toggle_two_hands.button_pressed,
		"debug_hands": toggle_skeletons.button_pressed,
	}
	socket.send_text(JSON.stringify(payload))


func _handle_server_message(data: Dictionary) -> void:
	var msg_type: String = str(data.get("type", ""))
	match msg_type:
		"connected":
			server_architecture = str(data.get("architecture", "unknown"))
			_set_status("Connected. " + server_architecture)
			_send_settings()
		"settings_ack":
			pass
		"frame_data":
			_handle_frame_data(data)
		"error":
			_set_status("Server error: " + str(data.get("message", "unknown")))
		_:
			pass


func _handle_frame_data(data: Dictionary) -> void:
	if toggle_send_frames.button_pressed and data.has("frame_base64"):
		_update_frame(str(data.get("frame_base64", "")))

	var detection_v: Variant = data.get("detection", {})
	if typeof(detection_v) == TYPE_DICTIONARY:
		var detection: Dictionary = detection_v
		_update_game_mechanic(detection)
		_update_metrics(data, detection)


func _update_frame(base64_jpg: String) -> void:
	if base64_jpg.is_empty():
		return

	var bytes: PackedByteArray = Marshalls.base64_to_raw(base64_jpg)
	if bytes.is_empty():
		return

	var image: Image = Image.new()
	var err: int = image.load_jpg_from_buffer(bytes)
	if err != OK:
		return

	if frame_texture == null:
		frame_texture = ImageTexture.create_from_image(image)
	else:
		frame_texture.update(image)

	camera_view.texture = frame_texture
	_update_display_fps()


func _update_display_fps() -> void:
	display_frame_count += 1
	var now_s: float = _now_s()
	var elapsed: float = now_s - display_fps_start_s
	if elapsed >= 1.0:
		display_fps = float(display_frame_count) / elapsed
		display_frame_count = 0
		display_fps_start_s = now_s


func _update_metrics(message: Dictionary, detection: Dictionary) -> void:
	var detection_fps: float = float(message.get("fps", 0.0))
	var raw_sign: String = str(detection.get("raw_sign", "idle"))
	var raw_conf: float = float(detection.get("raw_confidence", 0.0))
	var stable_sign: String = str(detection.get("stable_sign", "idle"))
	var stable_conf: float = float(detection.get("stable_confidence", 0.0))
	var hands: int = int(detection.get("hands", 0))
	var restricted: bool = bool(detection.get("restricted_signs", true))
	var light_status: String = str(detection.get("lighting_status", "unknown"))
	var light_mean: float = float(detection.get("lighting_mean", 0.0))
	var light_contrast: float = float(detection.get("lighting_contrast", 0.0))
	var vote_hits: int = int(detection.get("vote_hits", 0))
	var vote_size: int = int(detection.get("vote_window_size", 5))
	var vote_min: float = float(detection.get("vote_min_confidence", 0.45))
	var dist_v: Variant = detection.get("distance", null)
	var dist_text: String = "n/a"
	if dist_v != null:
		dist_text = "%.3f" % float(dist_v)

	latest_stable_sign = stable_sign
	latest_stable_conf = stable_conf
	latest_detection_fps = detection_fps

	var engine_fps: float = float(Engine.get_frames_per_second())
	metrics_label.text = "Display FPS: %.1f\n" % display_fps \
		+ "Engine FPS: %.1f\n" % engine_fps \
		+ "Detection FPS: %.1f\n" % detection_fps \
		+ "Stable: %s (%.2f)\n" % [stable_sign, stable_conf] \
		+ "Raw: %s (%.2f)\n" % [raw_sign, raw_conf] \
		+ "Dist: %s\n" % dist_text \
		+ "Hands: %d | 2H: %s\n" % [hands, "ON" if restricted else "OFF"] \
		+ "Light: %s (%.1f/%.1f)\n" % [light_status, light_mean, light_contrast] \
		+ "Vote: %d/%d (min %.2f)\n" % [vote_hits, vote_size, vote_min] \
		+ "Arch: " + server_architecture


func _on_game_mode_toggled(_enabled: bool) -> void:
	_reset_game_run()


func _on_jutsu_selected(index: int) -> void:
	if index < 0 or index >= jutsu_select.item_count:
		return
	game_current_jutsu = jutsu_select.get_item_text(index)
	_reset_game_run()
	_refresh_video_preview()


func _on_reset_run_pressed() -> void:
	_reset_game_run()


func _reset_game_run() -> void:
	game_step = 0
	game_last_accept_s = 0.0
	game_run_start_s = 0.0
	last_sequence_step_visual = -9999
	_update_game_progress_label()


func _current_sequence() -> Array:
	if not JUTSU_SEQUENCES.has(game_current_jutsu):
		return []
	var seq_v: Variant = JUTSU_SEQUENCES.get(game_current_jutsu, [])
	if typeof(seq_v) == TYPE_ARRAY:
		var seq: Array = seq_v
		return seq
	return []


func _update_game_mechanic(detection: Dictionary) -> void:
	if not toggle_game_mechanic.button_pressed:
		return

	var stable_sign: String = str(detection.get("stable_sign", "idle")).to_lower()
	if stable_sign == "idle" or stable_sign == "unknown":
		return

	var sequence: Array = _current_sequence()
	if sequence.is_empty():
		return

	if game_step >= sequence.size():
		game_step = 0

	var target_sign: String = str(sequence[game_step]).to_lower()
	if stable_sign != target_sign:
		return

	var now_s: float = _now_s()
	if now_s - game_last_accept_s < game_step_cooldown_s:
		return

	if game_step == 0 and game_run_start_s <= 0.0:
		game_run_start_s = now_s

	game_last_accept_s = now_s
	game_step += 1

	_play_step_sfx()
	_emit_step_particles(stable_sign)

	if game_step >= sequence.size():
		var run_time: float = max(0.0, now_s - game_run_start_s)
		game_completions += 1
		if game_best_time_s <= 0.0 or run_time < game_best_time_s:
			game_best_time_s = run_time
		_set_status("Completed %s in %.2fs" % [game_current_jutsu, run_time])
		_play_complete_sfx()
		_emit_complete_particles()
		_replay_video_preview()
		game_step = 0
		game_run_start_s = 0.0


func _update_game_progress_label() -> void:
	if not game_root.visible:
		return

	var sequence: Array = _current_sequence()
	_refresh_sequence_ui(sequence)
	_update_sign_preview(sequence)

	var run_timer_text: String = "--"
	if game_run_start_s > 0.0 and toggle_game_mechanic.button_pressed:
		run_timer_text = "%.2f" % max(0.0, _now_s() - game_run_start_s)

	var best_time_text: String = "--"
	if game_best_time_s > 0.0:
		best_time_text = "%.2f" % game_best_time_s

	var total_steps: int = sequence.size()
	var current_step_display: int = 0
	if total_steps > 0:
		current_step_display = min(game_step + 1, total_steps)

	game_progress_label.text = "Jutsu: %s\n" % game_current_jutsu \
		+ "Step: %d/%d\n" % [current_step_display, total_steps] \
		+ "Mechanic: %s\n" % ("ON" if toggle_game_mechanic.button_pressed else "OFF") \
		+ "Run: %ss | Best: %ss\n" % [run_timer_text, best_time_text] \
		+ "Completions: %d | Last: %s (%.2f)" % [game_completions, latest_stable_sign, latest_stable_conf]


func _refresh_sequence_ui(sequence: Array) -> void:
	var signature: String = _sequence_signature(sequence)
	if signature != last_sequence_signature:
		last_sequence_signature = signature
		_rebuild_sequence_strip(sequence)
		last_sequence_step_visual = -9999

	var mechanic_enabled: bool = toggle_game_mechanic.button_pressed
	if game_step == last_sequence_step_visual and mechanic_enabled == last_sequence_enabled_visual:
		return

	last_sequence_step_visual = game_step
	last_sequence_enabled_visual = mechanic_enabled
	_apply_sequence_states(sequence, mechanic_enabled)


func _sequence_signature(sequence: Array) -> String:
	if sequence.is_empty():
		return ""
	var built: String = ""
	for idx: int in range(sequence.size()):
		built += str(sequence[idx]).to_lower()
		if idx < sequence.size() - 1:
			built += "|"
	return built


func _rebuild_sequence_strip(sequence: Array) -> void:
	var old_children: Array = sequence_strip.get_children()
	for idx: int in range(old_children.size()):
		var child_v: Variant = old_children[idx]
		if child_v is Node:
			var child_node: Node = child_v as Node
			child_node.queue_free()

	sequence_card_nodes.clear()
	sequence_icon_nodes.clear()
	sequence_label_nodes.clear()

	for idx2: int in range(sequence.size()):
		var sign_name: String = str(sequence[idx2]).to_lower()
		var card: PanelContainer = PanelContainer.new()
		card.custom_minimum_size = Vector2(92, 112)
		card.mouse_filter = Control.MOUSE_FILTER_IGNORE
		card.add_theme_stylebox_override(
			"panel",
			_make_sequence_card_style(Color(0.10, 0.10, 0.14, 0.95), Color(0.36, 0.36, 0.46, 0.95), 2)
		)

		var vbox: VBoxContainer = VBoxContainer.new()
		vbox.alignment = BoxContainer.ALIGNMENT_CENTER
		vbox.add_theme_constant_override("separation", 4)
		card.add_child(vbox)

		var icon: TextureRect = TextureRect.new()
		icon.custom_minimum_size = Vector2(66, 66)
		icon.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		var tex_v: Variant = sign_textures.get(sign_name, null)
		if tex_v is Texture2D:
			icon.texture = tex_v as Texture2D
		vbox.add_child(icon)

		var sign_label: Label = Label.new()
		sign_label.text = sign_name.to_upper()
		sign_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		sign_label.add_theme_font_size_override("font_size", 12)
		vbox.add_child(sign_label)

		sequence_strip.add_child(card)
		sequence_card_nodes.append(card)
		sequence_icon_nodes.append(icon)
		sequence_label_nodes.append(sign_label)


func _apply_sequence_states(sequence: Array, mechanic_enabled: bool) -> void:
	if sequence.is_empty():
		sequence_status_label.text = "NEXT SIGN: --"
		return

	var target_idx: int = game_step
	if target_idx < 0:
		target_idx = 0
	if target_idx >= sequence.size():
		target_idx = sequence.size() - 1

	var next_sign: String = str(sequence[target_idx]).to_upper()
	if mechanic_enabled:
		sequence_status_label.text = "NEXT SIGN: " + next_sign
	else:
		sequence_status_label.text = "MECHANIC OFF (sequence paused)"

	for idx: int in range(sequence.size()):
		var state: int = 0
		if mechanic_enabled and idx < game_step:
			state = 2
		elif mechanic_enabled and idx == target_idx:
			state = 1
		_apply_sequence_card_state(idx, state)


func _apply_sequence_card_state(index: int, state: int) -> void:
	if index < 0 or index >= sequence_card_nodes.size():
		return

	var card_v: Variant = sequence_card_nodes[index]
	var icon_v: Variant = sequence_icon_nodes[index]
	var label_v: Variant = sequence_label_nodes[index]
	if not (card_v is PanelContainer):
		return

	var card: PanelContainer = card_v as PanelContainer
	var fill_color: Color = Color(0.10, 0.10, 0.14, 0.95)
	var border_color: Color = Color(0.36, 0.36, 0.46, 0.95)
	var text_color: Color = Color(0.84, 0.84, 0.90, 1.0)
	var icon_color: Color = Color(1.0, 1.0, 1.0, 0.82)

	if state == 2:
		fill_color = Color(0.08, 0.17, 0.12, 0.95)
		border_color = Color(0.36, 0.88, 0.55, 1.0)
		text_color = Color(0.62, 0.96, 0.74, 1.0)
		icon_color = Color(0.74, 1.0, 0.86, 0.90)
	elif state == 1:
		fill_color = Color(0.17, 0.11, 0.07, 0.97)
		border_color = Color(1.0, 0.56, 0.18, 1.0)
		text_color = Color(1.0, 0.86, 0.58, 1.0)
		icon_color = Color(1.0, 1.0, 1.0, 1.0)

	card.add_theme_stylebox_override("panel", _make_sequence_card_style(fill_color, border_color, 2))
	if icon_v is TextureRect:
		var icon: TextureRect = icon_v as TextureRect
		icon.modulate = icon_color
	if label_v is Label:
		var sign_label: Label = label_v as Label
		sign_label.modulate = text_color


func _make_sequence_card_style(fill_color: Color, border_color: Color, border_width: int) -> StyleBoxFlat:
	var style: StyleBoxFlat = StyleBoxFlat.new()
	style.bg_color = fill_color
	style.border_color = border_color
	style.border_width_left = border_width
	style.border_width_right = border_width
	style.border_width_top = border_width
	style.border_width_bottom = border_width
	style.corner_radius_top_left = 10
	style.corner_radius_top_right = 10
	style.corner_radius_bottom_left = 10
	style.corner_radius_bottom_right = 10
	return style


func _update_sign_preview(sequence: Array) -> void:
	if sequence.is_empty():
		sign_preview.texture = null
		sign_name_label.text = "NEXT: --"
		return

	var index: int = 0
	if toggle_game_mechanic.button_pressed:
		index = game_step
	if index < 0:
		index = 0
	if index >= sequence.size():
		index = sequence.size() - 1

	var sign_name: String = str(sequence[index]).to_lower()
	sign_name_label.text = "NEXT: " + sign_name.to_upper()
	var tex_v: Variant = sign_textures.get(sign_name, null)
	if tex_v is Texture2D:
		sign_preview.texture = tex_v as Texture2D
	else:
		sign_preview.texture = null
		sign_name_label.text += " (no image)"


func _refresh_video_preview() -> void:
	video_preview.stop()
	video_preview.stream = null
	video_preview.visible = false

	var path_v: Variant = JUTSU_VIDEO_BY_NAME.get(game_current_jutsu, "")
	var path: String = str(path_v)
	if path.is_empty():
		video_hint_label.text = "No MP4 preview for " + game_current_jutsu + "."
		return

	if not ResourceLoader.exists(path):
		if FileAccess.file_exists(path):
			video_hint_label.text = UNSUPPORTED_VIDEO_FORMAT_TEXT
		else:
			video_hint_label.text = "Missing video: " + path.get_file()
		return

	var loaded: Resource = load(path)
	if loaded == null:
		video_hint_label.text = UNSUPPORTED_VIDEO_FORMAT_TEXT
		return

	if loaded is VideoStream:
		var stream: VideoStream = loaded as VideoStream
		video_preview.stream = stream
		video_preview.visible = true
		video_preview.play()
		video_hint_label.text = "Playing: " + path.get_file()
	else:
		video_hint_label.text = UNSUPPORTED_VIDEO_FORMAT_TEXT


func _replay_video_preview() -> void:
	if video_preview.stream == null:
		return
	video_preview.stop()
	video_preview.play()


func _emit_step_particles(sign_name: String) -> void:
	var color: Color = _color_for_sign(sign_name)
	step_particles.color = color
	step_particles.emitting = false
	step_particles.emitting = true


func _emit_complete_particles() -> void:
	complete_particles.color = Color(1.0, 0.95, 0.35, 1.0)
	complete_particles.emitting = false
	complete_particles.emitting = true


func _color_for_sign(sign_name: String) -> Color:
	var normalized: String = sign_name.to_lower()
	match normalized:
		"snake", "dragon", "chidori":
			return Color(0.2, 0.72, 1.0, 1.0)
		"horse", "tiger", "fireball":
			return Color(1.0, 0.56, 0.18, 1.0)
		"ram", "shadow", "clone":
			return Color(0.74, 0.64, 1.0, 1.0)
		"boar", "dog", "bird", "monkey", "ox":
			return Color(0.45, 1.0, 0.62, 1.0)
		_:
			return Color(1.0, 0.85, 0.42, 1.0)


func _play_step_sfx() -> void:
	if sfx_step.stream == null:
		return
	sfx_step.stop()
	sfx_step.play()


func _play_complete_sfx() -> void:
	if sfx_complete.stream == null:
		return
	sfx_complete.stop()
	sfx_complete.play()


func _now_s() -> float:
	return Time.get_ticks_msec() / 1000.0
