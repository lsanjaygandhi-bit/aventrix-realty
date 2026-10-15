#!/usr/bin/env python3
"""Draw the footer's night-skyline background: images/footer-skyline-gold.svg.

An original, procedurally drawn image (no stock artwork). The seed is fixed,
so every run produces exactly the same file:
    python3 tools/make-footer-skyline.py
"""
import pathlib
import random
random.seed(27)
W,H=1600,720; horizon=int(H*0.80)
out=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMaxYMin slice">',
'<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#040e0b"/><stop offset=".6" stop-color="#0d1a12"/><stop offset=".8" stop-color="#2a2410"/><stop offset="1" stop-color="#040a08"/></linearGradient>',
'<radialGradient id="g" cx=".7" cy=".8" r=".6"><stop offset="0" stop-color="#b8862e" stop-opacity=".35"/><stop offset="1" stop-color="#b8862e" stop-opacity="0"/></radialGradient>',
'<linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="m"><rect width="100%" height="100%" fill="url(#f)"/></mask>',
'<filter id="b"><feGaussianBlur stdDeviation="3"/></filter></defs>',
f'<rect width="{W}" height="{H}" fill="url(#s)"/><rect width="{W}" height="{H}" fill="url(#g)"/>','<g id="city">']
layers=[(0.55,'#0a1612','#96702a',0.07),(0.80,'#060e0b','#d6a03e',0.13),(1.0,'#030806','#ffc460',0.18)]
for depth,body,win,lit in layers:
    x=-20; wins=[]
    while x<W:
        bw=random.randint(40,120)
        bh=int(random.randint(120,520)*depth*(0.6+0.8*(x/W)))
        top=horizon-bh
        out.append(f'<rect x="{x}" y="{top}" width="{bw}" height="{bh}" fill="{body}"/>')
        if random.random()<0.25:
            sh=random.randint(20,60); out.append(f'<rect x="{x+bw//2-2}" y="{top-sh}" width="4" height="{sh}" fill="{body}"/>')
        for wy in range(top+10,horizon-6,12):
            for wx in range(x+6,x+bw-6,10):
                if random.random()<lit: wins.append(f'M{wx} {wy}h4v6h-4z')
        x+=bw+random.randint(2,14)
    out.append(f'<path fill="{win}" opacity="{0.85 if depth==1 else 0.75}" d="{"".join(wins)}"/>')
out.append('</g>')
out.append(f'<rect y="{horizon}" width="{W}" height="{H-horizon}" fill="#030a08" opacity=".75"/>')
out.append(f'<clipPath id="c"><rect y="{horizon}" width="{W}" height="{H-horizon}"/></clipPath><g clip-path="url(#c)"><g opacity=".3" filter="url(#b)"><use href="#city" transform="matrix(1 0 0 -1 0 {2*horizon})"/></g></g>')
out.append('</svg>')
s='\n'.join(out)
out_path = pathlib.Path(__file__).resolve().parent.parent / "images" / "footer-skyline-gold.svg"
out_path.write_text(s, encoding="utf-8")
print(f"wrote {out_path.name} ({len(s)} bytes)")
