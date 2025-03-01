import json
import os

def split_geojson(file_path):
    # Load the GeoJSON file
    with open(file_path, 'r', encoding='utf-8') as f:
        geojson_data = json.load(f)
    
    # Ensure it has 'features' key
    if 'features' not in geojson_data:
        print("Invalid GeoJSON file: Missing 'features' key.")
        return
    
    features = geojson_data['features']
    total_features = len(features)
    
    # Split the features into two parts
    mid = total_features // 2
    geojson_part1 = {"type": "FeatureCollection", "features": features[:mid]}
    geojson_part2 = {"type": "FeatureCollection", "features": features[mid:]}
    
    # Define output file paths
    dir_path = os.path.dirname(file_path)
    output_file1 = os.path.join(dir_path, "export_part1.geojson")
    output_file2 = os.path.join(dir_path, "export_part2.geojson")
    
    # Save the split GeoJSON files
    with open(output_file1, 'w', encoding='utf-8') as f1:
        json.dump(geojson_part1, f1, indent=4)
    
    with open(output_file2, 'w', encoding='utf-8') as f2:
        json.dump(geojson_part2, f2, indent=4)
    
    print(f"GeoJSON split successfully: {output_file1}, {output_file2}")

if __name__ == "__main__":
    split_geojson("export.geojson")