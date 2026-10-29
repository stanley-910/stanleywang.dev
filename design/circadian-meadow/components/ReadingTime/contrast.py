import math
def hx(h): h=h.lstrip('#'); return [int(h[i:i+2],16)/255 for i in (0,2,4)]
def lin(c): return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def L(h): r,g,b=[lin(c) for c in hx(h)]; return 0.2126*r+0.7152*g+0.0722*b
def cr(a,b):
    la,lb=sorted([L(a),L(b)],reverse=True); return (la+0.05)/(lb+0.05)
# oklab mix
def to_oklab(h):
    r,g,b=[lin(c) for c in hx(h)]
    l=0.4122214708*r+0.5363325363*g+0.0514459929*b
    m=0.2119034982*r+0.6806995451*g+0.1073969566*b
    s=0.0883024619*r+0.2817188376*g+0.6299787005*b
    l,m,s=[x**(1/3) for x in (l,m,s)]
    return (0.2104542553*l+0.7936177850*m-0.0040720468*s,1.9779984951*l-2.4285922050*m+0.4505937099*s,0.0259040371*l+0.7827717662*m-0.8086757660*s)
def from_oklab(L_,a,b):
    l=(L_+0.3963377774*a+0.2158037573*b)**3; m=(L_-0.1055613458*a-0.0638541728*b)**3; s=(L_-0.0894841775*a-1.2914855480*b)**3
    r=4.0767416621*l-3.3077115913*m+0.2309699292*s; g=-1.2684380046*l+2.6097574011*m-0.3413193965*s; bb=-0.0041960863*l-0.7034186147*m+1.7076147010*s
    def enc(c):
        c=max(0,min(1,c)); return 12.92*c if c<=0.0031308 else 1.055*c**(1/2.4)-0.055
    return '#'+''.join('%02x'%round(enc(c)*255) for c in (r,g,bb))
def mix(a,b,t):
    A,B=to_oklab(a),to_oklab(b); return from_oklab(*[x+(y-x)*t for x,y in zip(A,B)])
# Reading keyframes: (hour, page, ink, ink-muted)
K=[
 ('night',    21.4, '#10151d', '#dde2ea', '#8f97a3'),
 ('dawn',      6.5, '#e7e5e3', '#26262a', '#615f63'),
 ('day',      12.0, '#ebeae6', '#252522', '#63625e'),
 ('golden',   17.75,'#ece5da', '#2a251f', '#665e55'),
 ('sunset',   19.0, '#1c1619', '#ebe1da', '#a1958f'),
 ('twilight', 20.15,'#15131c', '#e5e0ea', '#9a94a3'),
]
for n,h,p,i,m in K: print(f"{n:9} {h:5} page {p} ink {cr(p,i):5.2f}:1 muted {cr(p,m):5.2f}:1")
# drift within families: light dawn->day->golden; dark sunset->twilight->night
print('-- light drift')
for a,b in [(1,2),(2,3)]:
  for t in (0.25,0.5,0.75):
    p=mix(K[a][2],K[b][2],t); i=mix(K[a][3],K[b][3],t); m=mix(K[a][4],K[b][4],t)
    print(K[a][0],K[b][0],t,p,f"{cr(p,i):.2f} {cr(p,m):.2f}")
print('-- dark drift')
for a,b in [(4,5),(5,0)]:
  for t in (0.25,0.5,0.75):
    p=mix(K[a][2],K[b][2],t); i=mix(K[a][3],K[b][3],t); m=mix(K[a][4],K[b][4],t)
    print(K[a][0],K[b][0],t,p,f"{cr(p,i):.2f} {cr(p,m):.2f}")
print('-- family switch crossfade, naive both-lerp golden->sunset')
for t in (0.25,0.5,0.75):
    p=mix(K[3][2],K[4][2],t); i=mix(K[3][3],K[4][3],t)
    print(t,p,i,f"{cr(p,i):.2f}")
print('-- switch with ink stepping at the page luminance midpoint')
for t in (0.25,0.45,0.55,0.75):
    p=mix(K[3][2],K[4][2],t); i=K[3][3] if t<0.5 else K[4][3]
    print(t,p,i,f"{cr(p,i):.2f}")
print('-- current tokens', cr('#ebeae6','#252522'), cr('#ebeae6','#63625e'), cr('#1b1b19','#e4e2da'), cr('#1b1b19','#9d9b94'))
print('hairline light',cr('#ebeae6','#8f8e89'),'dark',cr('#1b1b19','#6a6964'), 'night hairline', cr('#10151d','#5d6573'))
print('-- hairline search: mix ink-muted toward page until 3:1 boundary')
for n,h,p,i,m in K:
    best=None
    for k in range(0,101):
        c=mix(m,p,k/100)
        if cr(p,c)>=3.05: best=c
    print(n,p,'hairline',best,f"{cr(p,best):.2f}")
print('light alt', cr('#ebeae6','#858480'))
