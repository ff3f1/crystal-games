extends SceneTree
func _init():
	for n in ["battle", "battle2", "boss", "menu"]:
		var r = ResourceLoader.load("res://assets/music_old/%s.oggvorbisstr" % n)
		print(n, " -> ", r, " len=", r.get_length() if r else -1)
		if r:
			var seq: OggPacketSequence = r.packet_sequence
			var pages: Array = seq.packet_data
			var gran: PackedInt64Array = seq.granule_positions
			var f = FileAccess.open("res://assets/music_old/%s.pkt" % n, FileAccess.WRITE)
			f.store_32(pages.size())
			for i in pages.size():
				var pk: Array = pages[i]
				f.store_64(gran[i])
				f.store_32(pk.size())
				for p in pk:
					f.store_32(p.size())
					f.store_buffer(p)
			f.close()
	quit()
