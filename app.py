import webview
import json
import os
import sys

def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.dirname(os.path.abspath(__file__))

    return os.path.join(base_path, relative_path)

class Api:
    def __init__(self):
        # Save data in the user's home directory or a specific app data folder
        # to ensure persistence even if the exe is moved or running from temp
        self.data_dir = os.path.join(os.path.expanduser('~'), '.calendar_app_data')
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
        self.data_file = os.path.join(self.data_dir, 'data.json')

    def load_data(self):
        if os.path.exists(self.data_file):
            try:
                with open(self.data_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading data: {e}")
                return []
        return []

    def save_data(self, data):
        try:
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            return True
        except Exception as e:
            print(f"Error saving data: {e}")
            return False

if __name__ == '__main__':
    api = Api()
    html_path = resource_path("index.html")
    
    webview.create_window(
        'Gestor de Notas', 
        url=html_path, 
        js_api=api,
        width=1200, 
        height=800
    )
    webview.start(debug=False)
