extends SceneTree
# Вырезает голову из базового персонажа (Superhero) в отдельный скин-меш для надевания на одежду.

func extract(src: String, body_name: String, out_prefix: String) -> void:
	var sc: Node = load(src).instantiate()
	var sk: Skeleton3D = sc.find_children("*", "Skeleton3D", true, false)[0]
	var keep_bones = ["Head", "Neck"]
	for mi: MeshInstance3D in sc.find_children("*", "MeshInstance3D", true, false):
		var mesh: ArrayMesh = mi.mesh
		var skin: Skin = mi.skin
		var is_body = String(mi.name) == body_name
		var out = ArrayMesh.new()
		for s in mesh.get_surface_count():
			var arr: Array = mesh.surface_get_arrays(s)
			var mat = mesh.surface_get_material(s)
			if not is_body:
				out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr, [], {}, mesh.surface_get_format(s) & ~Mesh.ARRAY_FORMAT_VERTEX & ~0)
				out.surface_set_material(out.get_surface_count() - 1, mat)
				continue
			var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			var bones: PackedInt32Array = arr[Mesh.ARRAY_BONES]
			var weights: PackedFloat32Array = arr[Mesh.ARRAY_WEIGHTS]
			var bpv = bones.size() / verts.size()
			var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
			var ok = PackedByteArray(); ok.resize(verts.size())
			for v in verts.size():
				var best = -1; var bw = -1.0
				for k in bpv:
					if weights[v * bpv + k] > bw:
						bw = weights[v * bpv + k]; best = bones[v * bpv + k]
				var bname = skin.get_bind_name(best) if skin and best < skin.get_bind_count() else sk.get_bone_name(best)
				ok[v] = 1 if keep_bones.has(String(bname)) else 0
			var remap = {}
			var nidx = PackedInt32Array()
			var order: Array[int] = []
			for t in range(0, idx.size(), 3):
				if ok[idx[t]] and ok[idx[t + 1]] and ok[idx[t + 2]]:
					for j in 3:
						var o = idx[t + j]
						if not remap.has(o):
							remap[o] = order.size(); order.append(o)
						nidx.append(remap[o])
			var narr = []; narr.resize(Mesh.ARRAY_MAX)
			for a in Mesh.ARRAY_MAX:
				var src_a = arr[a]
				if src_a == null or a == Mesh.ARRAY_INDEX:
					continue
				var per = 1
				if a == Mesh.ARRAY_TANGENT: per = 4
				elif a == Mesh.ARRAY_BONES or a == Mesh.ARRAY_WEIGHTS: per = bpv
				var nv
				if src_a is PackedVector3Array: nv = PackedVector3Array()
				elif src_a is PackedVector2Array: nv = PackedVector2Array()
				elif src_a is PackedFloat32Array: nv = PackedFloat32Array()
				elif src_a is PackedInt32Array: nv = PackedInt32Array()
				elif src_a is PackedColorArray: nv = PackedColorArray()
				else: continue
				for o in order:
					for k in per:
						nv.append(src_a[o * per + k])
				narr[a] = nv
			narr[Mesh.ARRAY_INDEX] = nidx
			var fl = 0
			if bpv == 8: fl = Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS
			out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, narr, [], {}, fl)
			out.surface_set_material(out.get_surface_count() - 1, mat)
			print(out_prefix, " head tris ", nidx.size() / 3, " of ", idx.size() / 3)
		ResourceSaver.save(out, "%s_%s.res" % [out_prefix, String(mi.name).to_lower()])
		if skin: ResourceSaver.save(skin, "%s_%s_skin.res" % [out_prefix, String(mi.name).to_lower()])
		print("saved ", out_prefix, " ", mi.name)

func _init():
	extract("res://assets/chars/src/Superhero_Male_FullBody.gltf", "SuperHero_Male", "res://assets/chars/heads/m")
	extract("res://assets/chars/src/Superhero_Female_FullBody.gltf", "Superhero_Female", "res://assets/chars/heads/f")
	quit()
