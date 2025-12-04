from PIL import Image
import os

img_path = "icon.png"
ico_path = "icon.ico"

if os.path.exists(img_path):
    img = Image.open(img_path)
    img.save(ico_path, format='ICO', sizes=[(256, 256)])
    print(f"Converted {img_path} to {ico_path}")
else:
    print(f"File {img_path} not found")
