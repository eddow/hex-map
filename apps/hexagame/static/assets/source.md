# Sources

## Textures

https://3djungle.net

for file in *.jpg; do convert "$file" "${file%.jpg}.png"; done
for file in *.png; do convert "$file" -resize 512x512! "${file%.png}_512.png"; done

## Models

https://free3d.com/