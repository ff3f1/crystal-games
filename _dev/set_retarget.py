import sys,re
# usage: set_retarget.py file.import bonemap_res skeleton_path [fix_silhouette]
f,bm,skp=sys.argv[1],sys.argv[2],sys.argv[3]
fixs = len(sys.argv)>4 and sys.argv[4]=='1'
s=open(f).read()
sub='''_subresources={
"nodes": {
"PATH:%s": {
"retarget/bone_map": Resource("%s"),
"retarget/bone_renamer/rename_bones": true,
"retarget/bone_renamer/unique_node/make_unique": true,
"retarget/bone_renamer/unique_node/skeleton_name": "GeneralSkeleton",
"retarget/rest_fixer/apply_node_transforms": true,
"retarget/rest_fixer/normalize_position_tracks": true,
"retarget/rest_fixer/reset_all_bone_poses_after_import": true,
"retarget/rest_fixer/overwrite_axis": true,
"retarget/rest_fixer/fix_silhouette/enable": %s,
"retarget/remove_tracks/except_bone_transform": false,
"retarget/remove_tracks/unimportant_positions": true,
"retarget/remove_tracks/unmapped_bones": false
}
}
}''' % (skp,bm,'true' if fixs else 'false')
s=re.sub(r'_subresources=\{.*?\}\n(?=gltf/)', sub+'\n', s, flags=re.S)
open(f,'w').write(s)
