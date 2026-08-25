import fitz
from pathlib import Path
pdf = Path('attached_assets/nba-josh-video-plan-v2_1786107626696.pdf')
out = Path('.agents/outputs/nba-josh-pdf-pages')
out.mkdir(parents=True, exist_ok=True)
doc = fitz.open(pdf)
print(f'pages={doc.page_count} metadata={doc.metadata}')
for i, page in enumerate(doc):
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    path = out / f'page-{i+1:02d}.png'
    pix.save(path)
    print(path)
