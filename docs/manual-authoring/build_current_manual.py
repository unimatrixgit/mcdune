from pathlib import Path
import re, math, json, html
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether, Flowable, Image as RLImage
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from PIL import Image as PILImage
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader
import yaml

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/Dune-Complete-Illustrated-Manual.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)

def pdf_art_file(path):
    path=Path(path)
    im=PILImage.open(path)
    if max(im.size)<1000:return str(path)
    import hashlib
    cache=ROOT/'tmp/pdfs/print-art';cache.mkdir(parents=True,exist_ok=True)
    target=cache/(path.stem+'-'+hashlib.sha1(str(path).encode()).hexdigest()[:8]+'.jpg')
    if not target.exists() or target.stat().st_mtime<path.stat().st_mtime:
        im.convert('RGB').save(target,'JPEG',quality=94,subsampling=0,optimize=True)
    return str(target)
def Image(path,*args,**kwargs):
    return RLImage(pdf_art_file(path),*args,**kwargs)

for name, file in [('Arial','arial.ttf'),('ArialBold','arialbd.ttf'),('ArialItalic','ariali.ttf')]:
    pdfmetrics.registerFont(TTFont(name, 'C:/Windows/Fonts/'+file))
pdfmetrics.registerFontFamily('Arial', normal='Arial', bold='ArialBold', italic='ArialItalic', boldItalic='ArialBold')
pdfmetrics.registerFont(TTFont('GeorgiaBold', 'C:/Windows/Fonts/georgiab.ttf'))
ART = ROOT/'docs/artwork'
INK = colors.HexColor('#233232'); GOLD=colors.HexColor('#a46b24'); PALE=colors.HexColor('#f2e7d2')
W,H=A4
STYLE = {
 'body': ParagraphStyle('body',fontName='Arial',fontSize=10.2,leading=14.6,textColor=INK,spaceAfter=9),
 'title': ParagraphStyle('title',fontName='GeorgiaBold',fontSize=24,leading=29,textColor=INK,spaceAfter=18),
 'label': ParagraphStyle('label',fontName='ArialBold',fontSize=8.5,leading=11,textColor=GOLD,spaceAfter=8),
 'sub': ParagraphStyle('sub',fontName='ArialBold',fontSize=12.3,leading=16,textColor=GOLD,spaceBefore=10,spaceAfter=7),
 'cell': ParagraphStyle('cell',fontName='Arial',fontSize=8.8,leading=12,textColor=INK),
 'headcell': ParagraphStyle('headcell',fontName='ArialBold',fontSize=8.6,leading=11.5,textColor=colors.white),
 'bullet': ParagraphStyle('bullet',fontName='Arial',fontSize=10.2,leading=14.3,leftIndent=12,firstLineIndent=-10,spaceAfter=6,textColor=INK),
 'small': ParagraphStyle('small',fontName='Arial',fontSize=8.5,leading=11.8,textColor=INK,spaceAfter=7),
}
def markup(s):
    s=html.escape(s)
    s=re.sub(r'\*\*(.*?)\*\*',r'<b>\1</b>',s)
    s=re.sub(r'`(.*?)`',r'<font name="Courier" size="9">\1</font>',s)
    return s

class Manual(BaseDocTemplate):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,**kwargs)
        self.chapter='FIELD MANUAL'
    def afterFlowable(self, f):
        if getattr(f,'toc_title',None):
            key='chapter-'+str(self.page)+'-'+str(abs(hash(f.toc_title)))
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(f.toc_title,key,0)
            self.notify('TOCEntry',(0,f.toc_title,self.page,key))
            self.chapter=f.toc_title.upper()

def footer(c,doc):
    if doc.page==1:
        art=ImageReader(pdf_art_file(ART/'arrakis-cover.png'));iw,ih=art.getSize();scale=max(W/iw,H/ih)
        c.drawImage(art,(W-iw*scale)/2,(H-ih*scale)/2,width=iw*scale,height=ih*scale)
        c.setFillColor(colors.HexColor('#162424'));c.setFillAlpha(.62);c.rect(0,H-290,W,290,fill=1,stroke=0);c.setFillAlpha(1)
        c.setFillColor(PALE);c.setFont('ArialBold',10);c.drawString(48,H-56,'PROJECT DUNE / PLAYER + ADMIN EDITION')
        c.setFont('GeorgiaBold',68);c.drawString(48,H-140,'DUNE')
        c.setFont('Arial',25);c.drawString(48,H-178,'The illustrated field manual')
        c.setFont('Arial',11);c.drawString(48,H-213,'ARRAKIS / FACTIONS / SPICE / THE SPACING GUILD')
        c.setStrokeColor(PALE);c.line(48,H-233,W-48,H-233)
        c.setFont('Arial',9);c.drawString(48,H-251,'DuneCore 1.0.8  |  DuneNPC 1.0.0  |  DuneTerrain 1.0.7  |  DuneEss 1.0.1')
        c.setFillColor(colors.HexColor('#102322'));c.setFillAlpha(.80);c.rect(0,0,W,59,fill=1,stroke=0);c.setFillAlpha(1)
        c.setFillColor(PALE);c.setFont('Arial',9);c.drawString(48,34,'Minecraft Java / Paper 1.21.4 / Java 21');c.drawString(48,19,'NPC edition / 13 October 2026 / 68 illustrated reference icons')
        return
    c.setFillColor(colors.HexColor('#fcf9f1'));c.rect(0,0,W,H,fill=1,stroke=0)
    c.setStrokeColor(colors.HexColor('#e7dac0'));c.setLineWidth(.6)
    for offset in range(3):
        p=c.beginPath();p.moveTo(0,8+offset*5)
        for x in range(0,int(W)+20,15):p.lineTo(x,8+offset*5+4*math.sin(x/90+offset*.6))
        c.drawPath(p,stroke=1,fill=0)
    c.setStrokeColor(PALE);c.setLineWidth(1);c.line(48,H-45,W-48,H-45)
    c.setFont('ArialBold',8);c.setFillColor(GOLD);c.drawString(48,H-35,'DUNE / USER MANUAL')
    c.setFont('Arial',8);c.drawRightString(W-48,H-35,'NPC EDITION / 13 OCTOBER 2026')
    c.setStrokeColor(PALE);c.line(48,44,W-48,44)
    c.setFillColor(INK);c.setFont('Arial',8);c.drawString(48,30,'PLAYER + ADMIN EDITION')
    c.drawRightString(W-48,30,str(doc.page))

def artwork_intro(title, subtitle, image):
    story.extend([Paragraph('ILLUSTRATED FIELD NOTES',STYLE['label'])])
    heading=Paragraph(title,STYLE['title']);heading.toc_title=title;story.append(heading)
    story.append(Image(str(image),width=W-96,height=(W-96)*PILImage.open(image).height/PILImage.open(image).width))
    story.extend([Spacer(1,15),Paragraph(subtitle,STYLE['body']),Spacer(1,20),Paragraph('THE SPICE MUST FLOW',STYLE['title']),
        table(['|Shelter|Spice|Shai-Hulud|','|A complete stillsuit and a reliable sietch are the start of every expedition.|Recognize the tagged shovel and harvestable deposits before taking a quota job.|Watch sightings, prepare for combat, and treat coordinates as an initial report.|']),Spacer(1,12),
        Paragraph('Concept artwork illustrates the theme; it is not a screenshot or a promise of additional game structures.',STYLE['small']),PageBreak()])

class GuildTimeline(Flowable):
    def __init__(self):super().__init__();self.width=W-96;self.height=86
    def draw(self):
        c=self.canv;c.setStrokeColor(GOLD);c.setFillColor(GOLD);c.setLineWidth(1.4)
        xs=[26,self.width/2,self.width-26]
        c.line(xs[0],55,xs[-1],55)
        for x in xs:c.circle(x,55,4,fill=1,stroke=0)
        c.setFont('ArialBold',9);c.setFillColor(INK)
        c.drawString(0,70,'ARRAKIS SIGHTING');c.drawCentredString(xs[1],70,'15 REAL MINUTES');c.drawRightString(self.width,70,'GUILD NOTICE')
        c.setFont('Arial',8)
        c.drawString(0,34,'Coordinates + local warning');c.drawCentredString(xs[1],34,'Deadline survives restart');c.drawRightString(self.width,34,'All online proxy players')
        c.setFillColor(GOLD);c.drawCentredString(self.width/2,13,'If Arrakis is empty at the deadline, delivery waits for a player connection.')

def table(lines, widths=None):
    rows=[[x.strip() for x in line.strip('|').split('|')] for line in lines]
    cols=len(rows[0]); width=W-96
    if widths is None:
        widths=[width*.43,width*.57] if cols==2 else [width/cols]*cols
    data=[[Paragraph(markup(cell), STYLE['headcell' if r==0 else 'cell']) for cell in row] for r,row in enumerate(rows)]
    t=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),INK),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f6f1e8')]),
        ('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),
        ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,0),1,GOLD)]))
    return t

class Notes(Flowable):
    def __init__(self,height=230):super().__init__();self.width=W-96;self.height=height
    def draw(self):
        self.canv.setStrokeColor(PALE);self.canv.setLineWidth(.7)
        for y in range(20,int(self.height),25):self.canv.line(0,y,self.width,y)


def hero_page(title, filename, caption):
    art = ROOT/'docs/artwork'/filename
    iw, ih = PILImage.open(art).size
    height = 510
    width = height*iw/ih
    if width > W-96:
        width = W-96
        height = width*ih/iw
    heading = Paragraph(title, STYLE['title']); heading.toc_title = title
    picture = Image(str(art), width=width, height=height); picture.hAlign='CENTER'
    story.extend([Paragraph('DUNE / ILLUSTRATED WORLDS AND CHARACTERS',STYLE['label']), heading,
        picture, Spacer(1,14), Paragraph(caption,STYLE['body']),
        Paragraph('Concept artwork. The adjacent guide describes the implemented plugin behavior.',STYLE['small']), PageBreak()])

HEROES = {
    'Meeting the roaming smugglers': ('A contact beyond the ledgers','smuggler-spice-mission.png','Sand-tan robes and green dust identify a roaming contact. Approach on Arrakis and right-click to see the smuggling offers available to your house.'),
    'Water for the Hidden Sietch': ('A light in the desert','smuggler-water-camp.png','Purple dust marks an active quest contact. Invisible light blocks brighten its camp while the player carries water toward a different smuggler.'),
    'The Imperial Admin Scepter': ('The keeper of the routes','imperial-npc-administration.png','The glowing blaze rod opens operator controls. DuneNPC manages Guild Navigators, smugglers and their missions through its own linked administration page.'),
    'The Arrakis landscape': ('Arrakis / the desert world','world-0.png','Arrakis receives the full gameplay treatment in this edition: terrain, spice, sietches, survival, worms, rights and smuggling. This is the active field guide.'),
    'Giedi Prime': ('Giedi Prime / industrial shadows','world-1.png','A lore-inspired view of the Harkonnen world. The following reserved chapter records the released swamp and blackstone profile; the depicted industry is concept scenery.'),
    'Kaitain': ('Kaitain / the Imperial horizon','world-2.png','A lore-inspired Imperial vista. The following reserved chapter records the released plains, flowers and ores; palace architecture is concept scenery.'),
    'Caladan': ('Caladan / water and green lands','world-3.png','A lore-inspired Atreides vista. The following reserved chapter records the current jungle and water profile; additional local missions remain future documentation.'),
    'Sigma Draconis IV': ('Sigma Draconis IV / cold horizons','world-4.png','An Ordos-inspired cold-world concept. The following reserved chapter documents snowy terrain; new settlements and local survival systems are not implied.')
}

story=[Spacer(1,10),PageBreak()]
toc=TableOfContents();toc.levelStyles=[ParagraphStyle('toc',fontName='Arial',fontSize=9.5,leading=13.5,spaceBefore=1,textColor=INK)]
toc.tableStyle=TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('TOPPADDING',(0,0),(-1,-1),1),('BOTTOMPADDING',(0,0),(-1,-1),1)])
story += [Paragraph('HOW TO USE THIS BOOK',STYLE['label']),Paragraph('Contents',STYLE['title']),Paragraph('Player guidance comes first, followed by command references and server administration. Each of the four reserved planet chapters contains its currently implemented profile and space for future additions. Configuration values shown here are shipped defaults; your administrator may change them.',STYLE['body']),toc,PageBreak()]
raw=Path(__file__).with_name('manual-current-content.txt').read_text(encoding='utf-8')
artwork_intro('Beneath the sands of Arrakis','A field guide to the desert: reach a sietch, prepare your stillsuit, follow the spice and watch for Shai-Hulud. The gameplay chapters that follow explain exactly what the release implements.',ART/'sietch-panorama.png')
for block in raw.split('\n===PAGE===\n'):
    lines=block.strip().splitlines()
    if not lines:continue
    label,title=lines.pop(0).split(' | ',1)
    if title in HEROES: hero_page(*HEROES[title])
    scenes={
        'Harvesting melange': ('Melange among the terraces','spice-expedition.png','Wear your stillsuit, recognize the tagged netherite shovel and harvest the desert. Fremen receive two spice units per deposit. The plateau formations can have up to three levels, with at most five blocks between their heights.'),
        'Shai-Hulud: model, AI and combat': ('When Shai-Hulud rises','shai-hulud-encounter.png','A visible Sniffer body carries the sandworm skin while an invisible Husk supplies native zombie AI. Fight the visible body. Its default 500 health makes it a serious encounter; its death creates a rich spice field rather than a direct cash payout.'),
        'The five-backend network': ('The Guild connects the worlds','guild-navigator.png','The Spacing Guild navigator opens planet travel. Arrakis sighting coordinates remain local for fifteen real minutes before the Guild informs the proxy network. The heighliner in this illustration is lore scenery, not a flyable feature in the plugin.')
    }
    if title in scenes:
        scene_title,filename,caption=scenes[title]
        sh=Paragraph(scene_title,STYLE['title']);sh.toc_title=scene_title
        story.extend([Paragraph('ARRAKIS / ILLUSTRATED FIELD NOTES',STYLE['label']),sh,Image(str(ROOT/'docs/artwork'/filename),width=W-96,height=(W-96)*2/3),Spacer(1,20),Paragraph(caption,STYLE['body']),Spacer(1,12),Paragraph('The spice must flow.',STYLE['sub']),Paragraph('Concept artwork illustrates the game\'s themes. Creature scale and architecture are artistic interpretations, not screenshots. The following chapter describes the actual release behavior.',STYLE['small']),PageBreak()])
    heading=Paragraph(markup(title),STYLE['title']);heading.toc_title=title
    story += [Paragraph(markup(label.upper()),STYLE['label']),heading]
    if title=='The fifteen-minute Guild notice':story.append(GuildTimeline())
    i=0
    while i<len(lines):
        line=lines[i].strip()
        if not line:i+=1;continue
        if line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].strip().startswith('|'):rows.append(lines[i]);i+=1
            story += [table(rows),Spacer(1,10)];continue
        if line=='[NOTES]':story.append(Notes());i+=1;continue
        if line.startswith('## '):story.append(Paragraph(markup(line[3:]),STYLE['sub']))
        elif line.startswith('- '):story.append(Paragraph('- '+markup(line[2:]),STYLE['bullet']))
        else:story.append(Paragraph(markup(line),STYLE['body']))
        i+=1
    story.append(PageBreak())

atlas=PILImage.open(ART/'item-icons-atlas.png')
icon_dir=ROOT/'tmp/pdfs/icons';icon_dir.mkdir(parents=True,exist_ok=True)
icons=[]
for row in range(8):
    for col in range(6):
        path=icon_dir/f'item-{row*6+col+1:02d}.png'
        atlas.crop((round(col*atlas.width/6),round(row*atlas.height/8),round((col+1)*atlas.width/6),round((row+1)*atlas.height/8))).save(path)
        icons.append(path)

card_title=ParagraphStyle('cardtitle',fontName='ArialBold',fontSize=10,leading=13,textColor=INK,spaceAfter=6)
card_body=ParagraphStyle('cardbody',fontName='Arial',fontSize=9,leading=12,textColor=INK)
def catalogue(title, intro, entries, note):
    story.append(Paragraph('ILLUSTRATED ITEM CATALOGUE',STYLE['label']))
    heading=Paragraph(title,STYLE['title']);heading.toc_title=title;story.append(heading)
    story.append(Paragraph(intro,STYLE['body']))
    cards=[]
    for index,name,description in entries:
        cards.append([Image(str(icons[index]),width=116,height=116),Spacer(1,6),Paragraph(markup(name),card_title),Paragraph(markup(description),card_body)])
    t=Table([cards[:3],cards[3:]],colWidths=[(W-96)/3]*3,rowHeights=[233,233])
    t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#fffdf5')),
        ('BOX',(0,0),(-1,-1),.7,PALE),('INNERGRID',(0,0),(-1,-1),.5,PALE),
        ('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),10)]))
    story.extend([t,Spacer(1,12),Paragraph(note,STYLE['small']),PageBreak()])

factions=[('Fremen','orange','Arrakis','Unbreaking III on every kit piece; Swift Sneak III on leggings. Two spice units per deposit.','Spice Harvest Shovel','Tagged netherite shovel; Efficiency V and Unbreaking III. Required to harvest spice.'),
 ('Harkonnen','red','Giedi Prime','Combat damage +15%; matching full set refreshes Strength II.','Melange Spice','Tagged orange dye. Direct sales use /duneess sell; default base value 15 Solaris per unit.'),
 ('Corrino','purple','Kaitain','Protection III on kit armor; entity-caused incoming combat damage is reduced by 15%.','Arrakis Water','Tagged finite-source water bucket. Sold through /dune water sell; authorization affects price.'),
 ('Atreides','blue','Caladan','Movement can refresh Speed I. Matching full set adds four hearts while equipped.','Dune Navigator','Tagged Nether Star. Left- or right-click to open the menu; restore with /dune menuitem.'),
 ('Ordos','green','Sigma Draconis IV','Matching full set enables five-second Shadow Step on main-hand Ender Pearl use.','Ordos Implosion Charge','Tagged Wind Charge. Replenishes after launch; impact creates immediate TNT.')]
for row,(name,color,home,ability,utility,utility_desc) in enumerate(factions):
    entries=[(row*6,f'{name} helmet','Tagged leather stillsuit. Three armor points, toughness three, knockback resistance 0.1.'),
        (row*6+1,f'{name} chestplate','Tagged leather stillsuit. Eight armor points; required worn chestplate for the Elytra merge.'),
        (row*6+2,f'{name} leggings','Tagged leather stillsuit. Six armor points, toughness three, knockback resistance 0.1.'),
        (row*6+3,f'{name} boots','Tagged leather stillsuit. Three armor points. Wear all four slots for heat protection.'),
        (row*6+4,f'{name} winged suit','Tagged Elytra upgrade. Costs 1,000,000 Solaris plus a carried Elytra; retains chest protection.'),
        (row*6+5,utility,utility_desc)]
    catalogue(name+' field equipment',f'Homeworld: {home}. Faction suit color: {color}. '+ability,entries,'Illustrated reference icons. In-game kits use colored vanilla leather armor with custom attributes and tags; the winged item uses vanilla Elytra geometry. The sixth card is a related reference item, not necessarily an extra exclusive kit reward.')
catalogue('Sietch cache supplies','Each unclaimed personal cache contains all six supply types below. Claiming supplies is separate from harvesting a CHOAM quota.',[
 (30,'Gold helmet','One per personal cache. Protection II and Unbreaking II. Not a tagged stillsuit.'),
 (31,'Gold chestplate','One per personal cache. Protection II and Unbreaking II. Does not prevent heatstroke.'),
 (32,'Gold leggings','One per personal cache. Protection II and Unbreaking II.'),
 (33,'Gold boots','One per personal cache. Protection II and Unbreaking II.'),
 (34,'Oak planks','32 per cache. Ordinary building supplies.'),(35,'Bread','16 per cache. Ordinary food. The cache also contains 250 tagged spice units.')],
 'Cache overflow is transferred or dropped when you close the inventory. Each player can claim a specific sietch once. The enchanted gold gear does not qualify as a stillsuit.')
catalogue('Travel, weapons and explosives','These ordinary Minecraft items support plugin mechanics. They are not all granted by a faction kit.',[
 (36,'Ender Pearl','Main-hand use activates Ordos Shadow Step when wearing a matching full set.'),
 (37,'Ordinary Elytra','Carry one while wearing a stillsuit chestplate for the paid winged upgrade.'),
 (38,'Arrow','An arrow impact can activate a magma-marked spice bloom.'),
 (39,'Trident','A trident impact can also trigger a spice bloom.'),
 (40,'TNT','The tagged Ordos charge creates an immediate primed TNT explosion on impact.'),
 (41,'Iron sword','Haunted Fremen raiders carry one. Their equipment has zero gear drop chance.')],
 'Illustrated icons describe existing interactions; these pages do not add crafting recipes, new weapons, or a free-item command. Use only the documented kit and admin actions.')
catalogue('Markers and supporting items','Recognize the equipment and landscape markers involved in Arrakis gameplay and navigation.',[
 (42,'Raider leather helmet','Ordinary helmet worn by Haunted Fremen raiders. Not faction-tagged loot.'),
 (43,'Empty bucket','Used for natural-source collection. Normal water sales remove buckets; NPC water missions return empties.'),
 (44,'Suspicious sand','Arrakis spice deposit. The resource pack makes it spice-gold; harvest with the tagged shovel.'),
 (45,'Magma marker','Untriggered bloom: 3x3 lower patch with a raised central magma block.'),
 (46,'Glowstone marker','Raised bloom center after eruption. Nearby suitable sand becomes spice deposits.'),
 (47,'Guild compass','A Navigator interface icon for travel. It is a menu symbol, not a separately granted travel artifact.')],
 'Artwork is an illustrated reference, not a replacement resource pack. Actual models and textures come from Minecraft and the supplied DuneResourcePack.zip. The following page covers additional interface symbols; the entire vanilla item library is outside this catalogue.')

menu_atlas=PILImage.open(ART/'menu-icons-atlas.png')
menu_items=[('Gold ingot','Wallet / Solaris'),('Emerald','CHOAM contracts'),('Paper','Contract offer'),('Clock','Active job / time'),
 ('Writable book','Spice exchange'),('Book','Player listings'),('Chest','Cache / exchange'),('Shield','Faction selection'),
 ('Comparator','GUI reload guide'),('Barrier','Cancel listing'),('Oak door','Leave worker job'),('White banner','Faction help symbol'),
 ('Map','Arrakis travel guide'),('Husk spawn egg','Admin summon help'),('Leather chestplate','Kit menu symbol'),('Arrow','Previous / back')]
menu_cards=[]
for index,(name,role) in enumerate(menu_items):
    row,col=divmod(index,4);path=icon_dir/f'menu-{index+1:02d}.png'
    menu_atlas.crop((round(col*menu_atlas.width/4),round(row*menu_atlas.height/4),round((col+1)*menu_atlas.width/4),round((row+1)*menu_atlas.height/4))).save(path)
    menu_cards.append([Image(str(path),width=74,height=74),Spacer(1,5),Paragraph(name,STYLE['cell']),Paragraph(role,STYLE['small'])])
story.append(Paragraph('ILLUSTRATED INTERFACE CATALOGUE',STYLE['label']))
menu_title=Paragraph('Navigator and help symbols',STYLE['title']);menu_title.toc_title='Navigator and help symbols';story.append(menu_title)
story.append(Paragraph('These are recognizable vanilla material icons used by the Navigator or help guide. Clicking a menu icon runs an action; it does not grant the pictured object.',STYLE['body']))
menu_grid=Table([menu_cards[i:i+4] for i in range(0,16,4)],colWidths=[(W-96)/4]*4,rowHeights=[137]*4)
menu_grid.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#fffdf5')),('GRID',(0,0),(-1,-1),.5,PALE),('LEFTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),7)]))
story.extend([menu_grid,Spacer(1,10),Paragraph('The summon help uses a Husk spawn-egg menu symbol, but the actual summoned body is a Sniffer with an invisible Husk controller. Colored glass backgrounds are interface decoration.',STYLE['small']),PageBreak()])


admin_atlas = PILImage.open(ROOT/'output/pdf/artwork/admin-icons-atlas.png')
admin_entries = [
    ('Imperial Admin Scepter','Tagged blaze rod, gold name and glint. Right-click in the main hand; operators only. Custom model data 1006.'),
    ('Wandering trader egg','NPC administration icon: place an Arrakis Smuggler. An interface control, not a free egg item.'),
    ('Villager egg','NPC administration icon: place a stationary, protected Guild Navigator at your position.'),
    ('Sniffer egg','Imperial admin icon: summon Shai-Hulud. The actual worm is a Sniffer body with a hidden Husk controller.')]
admin_heading=Paragraph('Scepter and NPC controls',STYLE['title']); admin_heading.toc_title='Scepter and NPC controls'
story.extend([Paragraph('ILLUSTRATED ADMIN CATALOGUE',STYLE['label']), admin_heading,
    Paragraph('Four new reference icons join the original sixty-four. Artwork helps identify the material; the GUI does not grant the illustrated spawn eggs.',STYLE['body'])])
cards=[]
for i,(title,description) in enumerate(admin_entries):
    row,col=divmod(i,2)
    path=icon_dir/f'admin-{i+1}.png'
    admin_atlas.crop((round(col*admin_atlas.width/2),round(row*admin_atlas.height/2),round((col+1)*admin_atlas.width/2),round((row+1)*admin_atlas.height/2))).save(path)
    cards.append([Image(str(path),width=155,height=155),Spacer(1,8),Paragraph(title,card_title),Paragraph(description,card_body)])
grid=Table([cards[:2],cards[2:]],colWidths=[(W-96)/2]*2,rowHeights=[268,268])
grid.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#fffdf5')),('GRID',(0,0),(-1,-1),.7,PALE),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),12)]))
story.extend([grid,PageBreak()])

def flatten(d,prefix=''):
    for k,v in d.items():
        key=prefix+'.'+str(k) if prefix else str(k)
        if isinstance(v,dict):yield from flatten(v,key)
        else:yield key,json.dumps(v,ensure_ascii=True) if isinstance(v,(list,bool)) else str(v)

heading=Paragraph('Default configuration reference',STYLE['title']);heading.toc_title='Default configuration reference'
story += [Paragraph('ADMIN APPENDIX',STYLE['label']),heading,Paragraph('Every setting below is copied from the release configuration files. Existing server files can differ because upgrades keep their saved configuration. Paths are relative to the corresponding plugin config.yml. Full GUI layouts are controlled separately in gui.yml; contract templates are in server-jobs.yml.',STYLE['body'])]
for index,module in enumerate(['DuneCore','DuneNPC','DuneEss','DuneTerrain']):
    if index:story.append(PageBreak())
    directory='DuneRealms-minecraft-only' if module=='DuneCore' else module
    source=ROOT/directory/'src/main/resources/config.yml'
    data=yaml.safe_load(source.read_text(encoding='utf-8'))
    story += [Paragraph(module,STYLE['sub']),table(['|Setting|Shipped default|']+['|'+k+'|'+v+'|' for k,v in flatten(data)],widths=[(W-96)*.70,(W-96)*.30])]
doc=Manual(str(OUT),pagesize=A4,leftMargin=48,rightMargin=48,topMargin=66,bottomMargin=60,
    title='Dune User Manual - Player and Admin Edition',author='Project Dune',subject='Complete Arrakis gameplay, DuneNPC missions and administration, October 2026')
doc.addPageTemplates(PageTemplate(id='normal',frames=[Frame(48,60,W-96,H-126,id='content',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=footer))
doc.multiBuild(story)
reader=PdfReader(OUT)
text='\n'.join(p.extract_text() or '' for p in reader.pages)
(ROOT/'tmp/pdfs/extracted-manual.txt').write_text(text,encoding='utf-8')
assert '/dune summon sandworm' in text
assert 'Arrakis' in text and 'Sigma Draconis IV' in text
print(json.dumps({'pdf':str(OUT),'pages':len(reader.pages),'words':len(text.split())}))
