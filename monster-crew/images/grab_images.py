import os

def list_image_names():
    # Define common image extensions
    valid_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp')
    
    # Get all files in the current directory
    files = os.listdir('.')
    
    # Filter for images and sort them
    image_files = [f for f in files if f.lower().endswith(valid_extensions)]
    image_files.sort()

    # Save the names to a text file
    with open('image_list.txt', 'w', encoding='utf-8') as f:
        for name in image_files:
            f.write(name + '\n')
            
    print(f"Success! Found {len(image_files)} images. Names saved to 'image_list.txt'.")

if __name__ == "__main__":
    list_image_names()