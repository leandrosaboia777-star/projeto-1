"""Generate the original Saboia Cleaning app icon. Requires Pillow only for regeneration."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
root=Path(__file__).resolve().parent.parent
im=Image.new('RGB',(1024,1024),'#315E4F');d=ImageDraw.Draw(im)
d.ellipse((170,100,854,784),fill='#426D59')
d.polygon([(245,444),(512,216),(779,444),(779,744),(245,744)],fill='#F5F5E8')
d.line([(202,456),(512,190),(822,456)],fill='#DDF1AC',width=38,joint='curve')
d.rounded_rectangle((441,535,583,744),radius=14,fill='#73977C')
for x in [295,635]:
 d.rounded_rectangle((x,492,x+94,598),radius=9,fill='#BBD5B5')
 d.line((x+47,492,x+47,598),fill='#F5F5E8',width=7);d.line((x,545,x+94,545),fill='#F5F5E8',width=7)
d.ellipse((555,633,569,647),fill='#F5F5E8')
x,y=785,237
d.polygon([(x,y-60),(x+12,y-12),(x+60,y),(x+12,y+12),(x,y+60),(x-12,y+12),(x-60,y),(x-12,y-12)],fill='#DDF1AC')
fontfile='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
f=ImageFont.truetype(fontfile,64)
d.text((512,843),'Saboia Cleaning',font=f,anchor='mm',fill='#F5F5E8')
im.save(root/'assets/icon.png')
