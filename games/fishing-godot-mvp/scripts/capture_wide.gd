extends SceneTree
## Screenshot on a 20:9 Android-sized window. Checks for pillarboxing.
func _initialize() -> void:
    call_deferred("_capture")

func _capture() -> void:
    var scene := load("res://scenes/main.tscn") as PackedScene
    var game := scene.instantiate()
    root.add_child(game)
    current_scene = game
    game.start_game()
    for i in range(18):
        await process_frame
    await create_timer(0.5).timeout
    var img := root.get_texture().get_image()
    var width := img.get_width()
    var height := img.get_height()
    var dest := "res://build/ultrawide-preview.png"
    var saved := img.save_png(dest)
    var luma_left := 0.0
    var luma_right := 0.0
    var luma_middle := 0.0
    for y_ratio in [0.25, 0.45, 0.62]:
        var y := int(height * y_ratio)
        luma_left += img.get_pixel(9, y).get_luminance()
        luma_right += img.get_pixel(width - 10, y).get_luminance()
        luma_middle += img.get_pixel(int(width * 0.50), y).get_luminance()
    if saved != OK or width < 1800 or height < 900:
        push_error("SCREEN_ASPECT_FAIL: wide image capture failed: %d x %d" % [width, height])
        quit(1)
        return
    if luma_left < 0.035 or luma_right < 0.035:
        push_error("SCREEN_ASPECT_FAIL: likely black pillars: %f %f" % [luma_left, luma_right])
        quit(1)
        return
    print("ULTRAWIDE_20_9_OK: %d x %d, edges=%.3f/%.3f, center=%.3f" % [width, height, luma_left, luma_right, luma_middle])
    quit(0)
