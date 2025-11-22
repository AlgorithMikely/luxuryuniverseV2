import sys
import os
import traceback

# Add the current directory to sys.path
sys.path.append(os.getcwd())

try:
    print("Attempting to import cogs.tiktok_cog...")
    from cogs import tiktok_cog
    print("Import successful!")
except Exception:
    print("Import failed:")
    traceback.print_exc()
