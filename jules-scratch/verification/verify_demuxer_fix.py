from playwright.sync_api import sync_playwright
import sys
import socket
from contextlib import closing
import subprocess
import os
import time

def find_free_port():
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        s.bind(('', 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]

def run():
    port = find_free_port()
    print(f"Found free port: {port}")

    # Start the Vite server but don't capture its output.
    # Let it print directly to the console for easier debugging.
    vite_process = subprocess.Popen(
        ["npm", "run", "dev", "--", "--port", str(port)],
        cwd="frontend",
    )

    # Wait for a fixed amount of time for the server to start.
    print("Waiting 15 seconds for the Vite server to start...")
    time.sleep(15)
    print("Finished waiting. Assuming server is ready.")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if "DEMUXER_ERROR" in msg.text else None)

        try:
            print(f"Navigating to http://localhost:{port}/verify")
            page.goto(f"http://localhost:{port}/verify", timeout=60000)
            print("Waiting for audio to load...")
            page.wait_for_timeout(10000)

            if any("DEMUXER_ERROR" in error for error in errors):
                print("Verification failed: DEMUXER_ERROR found in console.")
                for error in errors:
                    print(error)
                sys.exit(1)
            else:
                print("Verification successful: No DEMUXER_ERROR found.")

        except Exception as e:
            print(f"An error occurred during Playwright execution: {e}")
            sys.exit(1)

        finally:
            print("Closing browser and terminating Vite process.")
            browser.close()
            vite_process.terminate()
            vite_process.wait()


if __name__ == "__main__":
    run()
