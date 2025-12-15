from PIL import Image
import os

def remove_background_and_convert():
    img_path = "logo_def.png"
    ico_path = "icon.ico"
    
    if not os.path.exists(img_path):
        print(f"File {img_path} not found")
        return

    img = Image.open(img_path).convert("RGBA")
    datas = img.getdata()

    new_data = []
    # Simple threshold to remove white/checkerboard-like light colors if they exist
    # But since the user said "checkerboard", it might be gray/white squares.
    # However, without seeing the image, it's risky to remove gray.
    # I will assume the user wants to remove the background which might be white or the checkerboard pattern.
    # If the checkerboard is "baked in", it's usually white and light gray squares.
    
    # Let's try to make white and light gray transparent.
    for item in datas:
        # Check for white or very light gray (checkerboard light square)
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            new_data.append((255, 255, 255, 0))
        # Check for light gray (checkerboard dark square - often around 204 or 220)
        elif item[0] > 200 and item[1] > 200 and item[2] > 200 and abs(item[0]-item[1]) < 10:
             new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)

    img.putdata(new_data)
    
    # Resize for icon
    img.save(ico_path, format='ICO', sizes=[(256, 256)])
    print(f"Converted {img_path} to {ico_path} with transparency processing")

if __name__ == "__main__":
    remove_background_and_convert()
