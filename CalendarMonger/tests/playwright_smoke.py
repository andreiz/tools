import contextlib
import datetime as dt
import functools
import http.server
import socket
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright, expect


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        return


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def start_server(root: Path):
    port = find_free_port()
    handler = functools.partial(QuietHandler, directory=str(root))
    httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd, port


def drag_select_with_shift(page, start_selector: str, end_selector: str):
    start = page.locator(start_selector)
    end = page.locator(end_selector)
    start.wait_for()
    end.wait_for()
    start_box = start.bounding_box()
    end_box = end.bounding_box()
    if not start_box or not end_box:
        raise RuntimeError("Could not resolve drag selection bounds.")

    page.mouse.move(start_box["x"] + start_box["width"] / 2, start_box["y"] + start_box["height"] / 2)
    page.mouse.down()
    page.mouse.move(end_box["x"] + end_box["width"] / 2, end_box["y"] + end_box["height"] / 2)
    page.keyboard.down("Shift")
    page.mouse.up()
    page.keyboard.up("Shift")


def main():
    repo_root = Path(__file__).resolve().parents[1]
    server, port = start_server(repo_root)
    url = f"http://127.0.0.1:{port}/index.html"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.goto(url)

            # Verify calendar renders and Today button syncs pickers.
            page.locator("#selectedMonth .calendar-day").first.wait_for()
            page.click("#todayButton")
            today = dt.datetime.now()
            month_value = page.locator("#monthPicker").input_value()
            year_value = page.locator("#yearPicker").input_value()
            assert int(month_value) == today.month - 1, "Month picker did not reset to current month."
            assert int(year_value) == today.year, "Year picker did not reset to current year."

            # Navigate months.
            current_month = int(month_value)
            page.click("#nextMonthBtn")
            next_month_value = int(page.locator("#monthPicker").input_value())
            assert next_month_value in {(current_month + 1) % 12, current_month + 1}, "Next month button did not advance."
            page.click("#prevMonthBtn")
            back_month_value = int(page.locator("#monthPicker").input_value())
            assert back_month_value == current_month, "Prev month button did not return to original month."

            # Create a range with shift-drag and add a label.
            drag_select_with_shift(
                page,
                '#selectedMonth .calendar-day[data-day="1"]',
                '#selectedMonth .calendar-day[data-day="5"]',
            )
            page.locator("#rangeLabel").fill("Playwright Range")
            page.click("#saveLabelBtn")
            expect(page.locator(".range-label", has_text="Playwright Range")).to_have_count(1)

            # Edit the range to add a note, then reopen to confirm it persisted.
            page.locator('.range-label:has-text("Playwright Range")').dblclick()
            page.locator("#rangeNote").fill("Booked via Playwright")
            page.click("#saveLabelBtn")
            page.locator('.range-label:has-text("Playwright Range")').dblclick()
            expect(page.locator("#rangeNote")).to_have_value("Booked via Playwright")
            page.click("#cancelLabelBtn")

            # Undo (Cmd/Ctrl+Z) should remove the range entirely.
            modifier = "Meta" if page.evaluate("navigator.platform").startswith("Mac") else "Control"
            # First undo reverts the note edit; second removes the range.
            page.keyboard.press(f"{modifier}+z")
            page.keyboard.press(f"{modifier}+z")
            expect(page.locator(".range-label", has_text="Playwright Range")).to_have_count(0)

            # Redo should bring the range back.
            page.keyboard.press(f"{modifier}+Shift+z")
            expect(page.locator(".range-label", has_text="Playwright Range")).to_have_count(1)

            browser.close()
    finally:
        with contextlib.suppress(Exception):
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    main()
