#!/usr/bin/env python3
"""Writes screens/_tablerows.html from production rows (read 18 Sep 2026; query: HS 6105 exporters with a valid GOTS,
sorted by most sources). Zaheen and A.R. Fashion are state samples, not query matches."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
# initials, tier, name, place, source count, marks (rank order), certificates [(hue, text)], more certs, the supplier's full EPB code list (build.py shows the 3 rarest), more lines, type, workers, state
ROWS = [
 ("AK","t1","Aboni Knitwear Ltd","Savar, Dhaka",11,["t1 EP","t1 RS","t2 BG","t2 BK"],[("pos","GOTS valid"),("cau","WRAP 11 d")],"+2","6102 6103 6104 6105 6106 6107 6108 6109 6110 6111 6114 6115","+9","Factory","3,314","sel"),
 ("SM","t1","S M Knitwears Limited","Gazipur",10,["t1 EP","t1 RS","t2 BG","t2 BK"],[("pos","GOTS valid"),("cau","WRAP expired")],"+4","6101 6102 6103 6104 6105 6106 6107 6108 6109 6110 6111 6112 6114 6115 6117 6201 6202 6203 6204 6205 6206 6207 6208 6209","+21","Factory","300",""),
 ("FA","t1","Fakir Apparels Ltd","Narayanganj",9,["t1 EP","t1 RS","t2 BG","t2 BK"],[("cau","GOTS 44 d"),("pos","WRAP valid")],"+5","4202 6101 6102 6103 6104 6105 6106 6107 6108 6109 6110 6111 6112 6113 6114 6115 6116 6117 6201 6202 6203 6204 6205 6206 6207 6208 6209 6210 6211 6212 6214 6215 6216 6217 6301 6302 6305 6307 6505","+36","Factory","2,700",""),
 ("UM","t1","Universal Menswear Ltd","Narayanganj",9,["t1 EP","t1 RS","t2 BG","t3 GO"],[("pos","GOTS valid"),("cau","WRAP expired")],"+1","6101 6102 6103 6104 6105 6106 6107 6108 6109 6110 6111 6113 6114 6117 6201 6202 6203 6204 6205 6206 6207 6208 6209 6210 6211","+22","Factory","1,364",""),
 ("MC","t1","Modele De Capital Ind Ltd","Narayanganj",9,["t1 EP","t1 RS","t2 BG","t2 BK"],[("pos","GOTS valid"),("cau","WRAP expired")],"+4","6103 6104 6105 6106 6107 6108 6109 6110 6111 6113 6114 6203 6204","+10","Factory","1,300",""),
 ("EF","t1","Energypac Fashions Ltd","Dhaka",9,["t1 EP","t1 RS","t2 BG","t3 GO"],[("cau","GOTS 70 d"),("cau","WRAP expired")],"+1","6101 6102 6103 6104 6105 6106 6107 6108 6109 6110 6111 6112 6115 6201 6202 6203 6204 6205 6206 6207 6208 6209 6210 6211 6212 6215","+23","Factory","1,005",""),
 ("ZK","t1","Zaheen Knitwears Limited (Shed - 3, 4, 5, 10, 11, 12, 13) &amp; (Building - Security, ETP and Fire Pump)","Narayanganj",1,["t1 RS"],[],"",[],"","Factory","1,634","sanc"),
 ("FK","t1","Fariha Knit Tex Limited","Narayanganj",8,["t1 EP","t1 RS","t2 BG","t2 BK"],[("pos","GOTS valid"),("cau","WRAP expired")],"+3","4202 6101 6102 6103 6104 6105 6106 6107 6108 6109 6110 6111 6112 6113 6114 6115 6116 6117 6201 6202 6203 6204 6205 6206 6207 6208 6209 6210 6211 6213 6214 6215 6216 6217 6501 6502 6504 6505 6506 6507","+37","Factory","7,305",""),
 ("LT","t1","Libas Textiles Limited","Gazipur",8,["t1 EP","t1 RS","t2 BG","t2 BK"],[("cau","GOTS 12 d"),("pos","WRAP valid")],"+3","6102 6103 6104 6105 6106 6107 6108 6109 6111 6112 6114 6201 6202 6203 6204 6205 6206 6207 6208 6209 6210","+18","Factory","5,998",""),
 ("AR","t2","A.R. Fashion","",1,["t2 BG"],[],"",[],"","Buying house","",""),
]
out = []
for ini,tier,name,place,n,marks,certs,morec,thumbs,morel,typ,workers,state in ROWS:
    cb = '<span class="cb on">{{ico:check}}</span>' if state == "sel" else '<span class="cb"></span>'
    pl = f'<span class="pl">{place}</span>' if place else ''
    mk = ''.join(f'<span class="mk sm {m.split()[0]}">{m.split()[1]}</span>' for m in marks[:4])
    rest = n - min(len(marks), 4)
    src = f'<span class="srcs"><span class="fig">{n}</span><span class="marks">{mk}</span>' + (f'<span class="cap">+{rest}</span>' if rest > 0 else '') + '</span>'
    if certs:
        cc = ''.join(f'<span class="chip {c}">{t}</span>' for c, t in certs) + (f'<a class="more" href="#">{morec}</a>' if morec else '')
        certcell = f'<span class="chips">{cc}</span>'
    else:
        certcell = '<span class="q">— none on 4 registers</span>'
    if thumbs:
        lines = f'<span class="thumbs">{{{{thumbs:{thumbs}|n=3}}}}<span class="n">{morel}</span></span>'
    else:
        lines = '<span class="q">— not on EPB list</span>'
    w = workers if workers else '<span class="q">—</span>'
    send = '<button class="btn pri" disabled>{{ico:send}} Send RFQ</button>' if state == "sanc" else '<button class="btn pri">{{ico:send}} Send RFQ</button>'
    sanl = '<div class="sanline">{{icos:warn}} Sanctioned · sample</div>' if state == "sanc" else ''
    cls = f' class="{state}"' if state else ''
    out.append(f'''<tr{cls}>
  <td>{cb}</td>
  <td><div class="sup"><span class="logo {tier}">{ini}</span><div><div class="nm">{name}{pl}</div>{sanl}</div></div></td>
  <td>{src}</td>
  <td>{certcell}</td>
  <td>{lines}</td>
  <td class="typ">{typ}</td>
  <td class="num">{w}</td>
  <td><span class="acts"><button class="btn icon" aria-label="Save">{{{{ico:bookmark}}}}</button>{send}</span></td>
</tr>''')
open(f"{HERE}/screens/_tablerows.html", "w").write('\n'.join(out) + '\n')
print("wrote", len(out), "rows")
