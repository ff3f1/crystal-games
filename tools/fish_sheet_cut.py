"""Lossless sheet extraction. Never invent detail or upscale supplied artwork.
Usage: python tools/fish_sheet_cut.py sheet.png names.json output --rows 4 --cols 4
names.json is a row-major list of item IDs; null cells are ignored.
"""
import argparse,json,hashlib
from pathlib import Path
from PIL import Image

def cut(source,names,dest,rows,cols):
 im=Image.open(source).convert('RGBA')
 if im.getchannel('A').getextrema()!=(0,255):raise ValueError('Sheet requires real transparency; background removal is not implicit')
 if len(names)>rows*cols:raise ValueError('Too many names for grid')
 dest.mkdir(parents=True,exist_ok=True);report=[]
 for n,name in enumerate(names):
  if not name:continue
  x=n%cols;y=n//cols;box=(round(x*im.width/cols),round(y*im.height/rows),round((x+1)*im.width/cols),round((y+1)*im.height/rows))
  cell=im.crop(box);bbox=cell.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox()
  if not bbox:raise ValueError('Empty named cell: '+name)
  touches=bbox[0]==0 or bbox[1]==0 or bbox[2]==cell.width or bbox[3]==cell.height
  content=cell.crop(bbox);pad=8;out=Image.new('RGBA',(content.width+pad*2,content.height+pad*2));out.paste(content,(pad,pad));out.save(dest/(name+'.png'))
  report.append(dict(id=name,cell=list(box),bbox=list(bbox),size=list(out.size),touches_cell_boundary=touches))
 (dest/'extraction.json').write_text(json.dumps(dict(source=str(source),sha256=hashlib.sha256(Path(source).read_bytes()).hexdigest(),items=report),indent=2))
 return report
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('source',type=Path);p.add_argument('names',type=Path);p.add_argument('dest',type=Path);p.add_argument('--rows',type=int,required=True);p.add_argument('--cols',type=int,required=True);a=p.parse_args();print(json.dumps(cut(a.source,json.loads(a.names.read_text()),a.dest,a.rows,a.cols),indent=2))
