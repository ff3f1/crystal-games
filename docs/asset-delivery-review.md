# Uploaded sheets and portrait bases

19 approved portrait bases at native 1122x1402 are used for spring/summer/autumn.
Winter retains existing seasonal art. No additional detail is invented by resizing.
`blacksea_base.png` has the exact same decoded pixels as `baikal_base.png` and
is excluded; the Black Sea retains the existing scene.

The ZIP fishing_props_and_items contains the earlier flat 4x4 item sheets and
simplified grip/reel. It does NOT contain the realistic 5x5 equipment sheets
shown inline in the user message. The original files for those two inline sheets
are needed before importing their contents. Do not silently replace them with
the old cartoon assets. The old supplied sheets have been extracted into 21
review-only items in the task workspace; none override the production icons.

`tools/fish_sheet_cut.py` extracts row-major grids, reports native cell/crop
coordinates and warns about edge contact. It preserves alpha and never upscales.
The two new sheets require a reviewed 5x5 naming map after their original PNGs
are available. Reel and rod artwork must be evaluated in context before adopting
it for the first-person scene, separately from shop thumbnails.

Ongoing repairs: lower reflection gain/exposure, stronger night attenuation for
both world and tackle, weather fronts every 150 active gameplay seconds, rain
streak geometry, relative drag steering and input release on focus loss. Fish
edge processing bleeds nearest opaque RGB into translucent edges up to four
native pixels without eroding alpha. Importing uses Pillow, numpy and scipy.

These remain draft changes, not a release quality or phone performance claim.
