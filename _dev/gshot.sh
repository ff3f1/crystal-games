#!/bin/bash
# gshot.sh <res-script> <width>x<height> args...
cd ~/bh
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json
S=$1; R=$2; shift 2
timeout ${GT:-300} xvfb-run -a -s "-screen 0 1920x1200x24" ~/tools/Godot_v4.7.2-stable_linux.x86_64 --audio-driver Dummy --resolution $R --script $S -- "$@" 2>&1 | grep -vE "PagedAllocator|never freed|resources still in use|ObjectDB|^\s+at: |Leaked instance|RID allocations|^$"
