#!/bin/bash
# grun.sh "<test spec>" [res]
cd ~/bh
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json
R=${2:-1920x1080}
timeout ${GT:-400} xvfb-run -a -s "-screen 0 1920x1200x24" ~/tools/Godot_v4.7.2-stable_linux.x86_64 --audio-driver Dummy --windowed --resolution $R --position 0,0 -- "--test=$1" 2>&1 | grep -vE "PagedAllocator|never freed|resources still in use|ObjectDB|^\s+at: |Leaked instance|RID allocations|RIDs of type|^$|ALSA|audio_driver|All audio drivers|Godot Engine v|Vulkan 1\."
