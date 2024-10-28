document.addEventListener("DOMContentLoaded", () => {
  const monthPicker = document.getElementById("monthPicker");
  const yearPicker = document.getElementById("yearPicker");
  const todayButton = document.getElementById("todayButton");
  const clearRangesButton = document.getElementById("clearRangesButton");

  let isDragging = false;
  let selectionStart = null;
  let selectionEnd = null;
  let firstCell = null;
  let savedRanges = [];

  const DateRange = {
    create: function(start, end, label, color) {
      const selectedMonth = parseInt(monthPicker.value);
      const selectedYear = parseInt(yearPicker.value);

      // Create the date objects and set time to midnight for consistent comparison
      const startDate = new Date(selectedYear, selectedMonth, parseInt(start, 10));
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(selectedYear, selectedMonth, parseInt(end, 10));
      endDate.setHours(23, 59, 59, 999);

      return {
        id: Date.now().toString(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        label: label,
        color: color || this.getDistinctHueColor(startDate.toISOString(), endDate.toISOString())
      };
    },

    hasOverlap: function(range1, range2) {
      const start1 = new Date(range1.startDate);
      const end1 = new Date(range1.endDate);
      const start2 = new Date(range2.startDate);
      const end2 = new Date(range2.endDate);

      return start1 <= end2 && start2 <= end1;
    },

    // Convert HSL to RGB hex color
    hslToHex: function(h, s, l) {
      let r, g, b;
      h /= 360;
      s /= 100;
      l /= 100;

      if (s === 0) {
        r = g = b = l;
      } else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }

      const toHex = x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };

      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    },

    // Extract hue from HSL color string
    getHueFromColor: function(color) {
      // Handle hex colors
      if (color.startsWith('#')) {
        // Convert hex to RGB
        const r = parseInt(color.slice(1, 3), 16) / 255;
        const g = parseInt(color.slice(3, 5), 16) / 255;
        const b = parseInt(color.slice(5, 7), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h;

        if (max === min) {
          return 0; // achromatic
        }

        const d = max - min;
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }

        return Math.round(h * 60);
      }
      // Handle hsl colors
      if (color.startsWith('hsl')) {
        return parseInt(color.match(/hsl\((\d+)/)[1]);
      }
      return 0;
    },

    // Predefined aesthetically pleasing hues
    baseHues: [
      0,    // Red
      120,  // Green
      240,  // Blue
      60,   // Yellow
      180,  // Cyan
      300,  // Magenta
      30,   // Orange
      90,   // Yellow-green
      150,  // Blue-green
      210,  // Blue-purple
      270,  // Purple
      330   // Pink
    ],

    getDistinctHueColor: function(startDate, endDate) {
      if (savedRanges.length === 0) {
        // First color - pick randomly from base hues
        const hue = this.baseHues[Math.floor(Math.random() * this.baseHues.length)];
        return this.hslToHex(hue, 70, 90);
      }

      const existingHues = savedRanges.map(range => 
        this.getHueFromColor(range.color)
      );

      // Find the base hue that's furthest from all existing hues
      let bestHue = 0;
      let maxMinDistance = 0;

      for (const baseHue of this.baseHues) {
        let minDistance = 360;

        for (const existingHue of existingHues) {
          let distance = Math.abs(baseHue - existingHue);
          if (distance > 180) {
            distance = 360 - distance;
          }
          minDistance = Math.min(minDistance, distance);
        }

        if (minDistance > maxMinDistance) {
          maxMinDistance = minDistance;
          bestHue = baseHue;
        }
      }

      return this.hslToHex(bestHue, 70, 90);
    },
  };

  // Load saved ranges from localStorage
  function loadSavedRanges() {
    const saved = localStorage.getItem('calendarRanges');
    if (saved) {
      savedRanges = JSON.parse(saved);
    }
  }

  // Save ranges to localStorage
  function saveRanges() {
    localStorage.setItem('calendarRanges', JSON.stringify(savedRanges));
  }

  // Load saved ranges on startup
  loadSavedRanges();

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  for (let i = 0; i < months.length; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = months[i];
    monthPicker.appendChild(option);
  }

  for (let i = currentYear - 1; i <= currentYear + 5; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = i;
    yearPicker.appendChild(option);
  }

  monthPicker.value = currentMonth;
  yearPicker.value = currentYear;

  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  const getFirstDayOfMonth = (year, month) => {
    const firstDay = new Date(year, month, 1).getDay();
    return firstDay === 0 ? 6 : firstDay - 1;
  };

  const getMonthNameAndYear = (year, month) => {
    const date = new Date(year, month);
    return date.toLocaleString("default", { month: "long", year: "numeric" });
  };

  function createCalendarDay(day) {
    const cell = document.createElement("div");
    cell.className = "calendar-day";
    if (day !== null) {
      const dayNumber = document.createElement("div");
      dayNumber.className = "day-number";
      dayNumber.textContent = day;
      cell.appendChild(dayNumber);

      const labelsContainer = document.createElement("div");
      labelsContainer.className = "day-labels";
      cell.appendChild(labelsContainer);

      const dayCount = document.createElement("div");
      dayCount.className = "selection-count";
      cell.appendChild(dayCount);

      cell.setAttribute("data-day", day);
    }
    return cell;
  }

  function createLabelInput(start, end) {
    const modal = document.createElement("div");
    modal.className = "label-modal";
    modal.innerHTML = `
      <div class="label-modal-content">
        <h3>Add Label for Selected Range</h3>
        <p>Days: ${start} - ${end}</p>
        <input type="text" id="rangeLabel" placeholder="Enter label" class="range-label-input">
        <div class="modal-buttons">
          <button id="saveLabelBtn" class="primary-button">Save</button>
          <button id="cancelLabelBtn" class="secondary-button">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector("#rangeLabel");
    const saveBtn = modal.querySelector("#saveLabelBtn");
    const cancelBtn = modal.querySelector("#cancelLabelBtn");

    return new Promise((resolve, reject) => {
      saveBtn.addEventListener("click", () => {
        const label = input.value.trim();
        if (label) {
          modal.remove();
          resolve(label);
        }
      });

      cancelBtn.addEventListener("click", () => {
        modal.remove();
        reject();
      });

      input.addEventListener("keyup", (e) => {
        if (e.key === "Enter" && input.value.trim()) {
          modal.remove();
          resolve(input.value.trim());
        } else if (e.key === "Escape") {
          modal.remove();
          reject();
        }
      });

      input.focus();
    });
  }

  function updateRangeDisplay() {
    const selectedMonth = parseInt(monthPicker.value);
    const selectedYear = parseInt(yearPicker.value);

    document.querySelectorAll("#selectedMonth .calendar-day").forEach(dayCell => {
      const day = dayCell.dataset.day;
      if (!day) return;

      // Clear all existing content and styling
      const labelsContainer = dayCell.querySelector(".day-labels");
      labelsContainer.innerHTML = "";
      dayCell.style.backgroundColor = "";
      dayCell.style.background = "";
      dayCell.style.opacity = "1";

      // Remove any existing classes
      dayCell.classList.remove('range-start', 'range-end');

      // Create a Date object for the current cell
      const cellDate = new Date(selectedYear, selectedMonth, parseInt(day));
      cellDate.setHours(12, 0, 0, 0);

      // Find ranges that include this date
      const matchingRanges = savedRanges.filter(range => {
        const startDate = new Date(range.startDate);
        const endDate = new Date(range.endDate);
        return cellDate >= startDate && cellDate <= endDate;
      });

      // Apply background colors
      if (matchingRanges.length > 1) {
        const gradientColors = matchingRanges.map(r => r.color);
        dayCell.style.background = `linear-gradient(45deg, ${gradientColors.join(', ')})`;
      } else if (matchingRanges.length === 1) {
        dayCell.style.backgroundColor = matchingRanges[0].color;
      }

      // Add start/end indicators
      matchingRanges.forEach(range => {
        const startDate = new Date(range.startDate);
        const endDate = new Date(range.endDate);

        if (startDate.getDate() === parseInt(day) && 
            startDate.getMonth() === selectedMonth && 
            startDate.getFullYear() === selectedYear) {
          dayCell.classList.add('range-start');

          // Add label for range start
          const label = document.createElement("div");
          label.className = "range-label";
          label.textContent = range.label;
          label.style.backgroundColor = range.color;
          label.setAttribute('data-range-id', range.id);

          const deleteBtn = document.createElement("button");
          deleteBtn.className = "delete-range";
          deleteBtn.innerHTML = "×";

          deleteBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            e.stopImmediatePropagation();
          });

          deleteBtn.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            e.preventDefault();
            e.stopImmediatePropagation();

            savedRanges = savedRanges.filter(r => r.id !== range.id);
            saveRanges();
            updateRangeDisplay();
          });

          label.appendChild(deleteBtn);
          labelsContainer.appendChild(label);
        }

        if (endDate.getDate() === parseInt(day) && 
            endDate.getMonth() === selectedMonth && 
            endDate.getFullYear() === selectedYear) {
          dayCell.classList.add('range-end');
        }
      });
    });
  }

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const createWeekdayLabels = (calendar) => {
    weekdays.forEach((day) => {
      const label = document.createElement("div");
      label.className = "weekday-label";
      label.textContent = day;
      calendar.appendChild(label);
    });
  };

  const clearCalendar = (calendar) => {
    calendar.innerHTML = "";
  };

  async function finalizeDateRange() {
    const clearSelectionUI = () => {
      isDragging = false;
      selectionStart = null;
      selectionEnd = null;

      document.querySelectorAll(".selection-count").forEach(counter => {
        counter.textContent = "";
      });

      document.querySelectorAll(".drag-highlight").forEach(cell => {
        cell.classList.remove("drag-highlight");
      });

      firstCell = null;
    };

    if (selectionStart && selectionEnd) {
      try {
        // Ensure we use the smaller number as start
        const startDay = Math.min(parseInt(selectionStart, 10), parseInt(selectionEnd, 10));
        const endDay = Math.max(parseInt(selectionStart, 10), parseInt(selectionEnd, 10));

        const label = await createLabelInput(startDay, endDay);
        const newRange = DateRange.create(startDay, endDay, label);

        // Add to existing ranges
        savedRanges = [...savedRanges, newRange];
        saveRanges();
        updateRangeDisplay();

        console.log('Added new range:', newRange); // Debug log
        console.log('Current ranges:', savedRanges); // Debug log
      } catch (e) {
        console.error('Error in finalizeDateRange:', e);
      } finally {
        clearSelectionUI();
      }
    } else {
      clearSelectionUI();
    }
  }


  const updateMonth = (year, month, elementId) => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    const monthElement = document.getElementById(elementId);
    clearCalendar(monthElement);
    createWeekdayLabels(monthElement);

    // Create empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      monthElement.appendChild(createCalendarDay(null));
    }

    // Create cells for each day of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const cell = monthElement.appendChild(createCalendarDay(i));
      if (isCurrentMonth && i === today.getDate()) {
        cell.classList.add("today-highlight");
      }
    }

    // Create empty cells to complete the last week if needed
    const totalDays = firstDay + daysInMonth;
    const remainingCells = (7 - (totalDays % 7)) % 7;
    for (let i = 0; i < remainingCells; i++) {
      monthElement.appendChild(createCalendarDay(null));
    }

    // Update ranges if this is the main month display
    if (elementId === "selectedMonth") {
      updateRangeDisplay();
    }
  };

  const updateCalendar = () => {
    const selectedMonth = parseInt(monthPicker.value);
    const selectedYear = parseInt(yearPicker.value);

    // Update the current month
    updateMonth(selectedYear, selectedMonth, "selectedMonth");

    // Calculate and update the previous month
    const prevMonthDate = new Date(selectedYear, selectedMonth - 1, 1);
    updateMonth(
      prevMonthDate.getFullYear(),
      prevMonthDate.getMonth(),
      "prevMonth"
    );
    document.getElementById("prevMonthLabel").textContent = getMonthNameAndYear(
      prevMonthDate.getFullYear(),
      prevMonthDate.getMonth()
    );

    // Calculate and update the next month
    const nextMonthDate = new Date(selectedYear, selectedMonth + 1, 1);
    updateMonth(
      nextMonthDate.getFullYear(),
      nextMonthDate.getMonth(),
      "nextMonth"
    );
    document.getElementById("nextMonthLabel").textContent = getMonthNameAndYear(
      nextMonthDate.getFullYear(),
      nextMonthDate.getMonth()
    );
  };

  monthPicker.addEventListener("change", updateCalendar);
  yearPicker.addEventListener("change", updateCalendar);
  todayButton.addEventListener("click", () => {
    const today = new Date();
    monthPicker.value = today.getMonth().toString();
    yearPicker.value = today.getFullYear().toString();
    updateCalendar();
  });

  clearRangesButton.addEventListener("click", () => {
    savedRanges = [];
    localStorage.removeItem('calendarRanges');
    updateRangeDisplay();
  });

  // Mouse event handlers for date selection
  const selectedContainer = document.getElementById("selectedMonth");

  selectedContainer.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      const targetDay = e.target.closest(".calendar-day");
      if (targetDay && targetDay.dataset.day) {
        isDragging = true;
        selectionStart = selectionEnd = targetDay.dataset.day;
        firstCell = targetDay;
        updateSelectionHighlights();
      }
    }
  });

  selectedContainer.addEventListener("mousemove", (e) => {
    if (isDragging) {
      const targetDay = e.target.closest(".calendar-day");
      if (targetDay && targetDay.dataset.day) {
        selectionEnd = targetDay.dataset.day;
        updateSelectionHighlights();
      }
    }
  });

  // Prevent text selection while dragging
  selectedContainer.addEventListener("dragstart", (e) => {
    e.preventDefault();
  });

  document.addEventListener("mouseup", async (e) => {
    if (isDragging) {
        if (e.shiftKey) {
            // If Shift is pressed, create label
            await finalizeDateRange();
        } else {
            // If Shift is not pressed, clear everything including highlights
            isDragging = false;
            selectionStart = null;
            selectionEnd = null;

            if (firstCell) {
                const countContainer = firstCell.querySelector(".selection-count");
                countContainer.textContent = "";
                firstCell = null;
            }

            // Clear all highlights
            document.querySelectorAll(".drag-highlight").forEach(cell => {
                cell.classList.remove("drag-highlight");
            });
        }
    }
  });

  function updateSelectionHighlights() {
    let countHighlighted = 0;
    document.querySelectorAll("#selectedMonth .calendar-day").forEach((dayCell) => {
      const day = dayCell.dataset.day;
      if (!day) return;

      const start = Math.min(selectionStart, selectionEnd);
      const end = Math.max(selectionStart, selectionEnd);

      if (day >= start && day <= end) {
        dayCell.classList.add("drag-highlight");
        countHighlighted = end - start + 1;
      } else {
        dayCell.classList.remove("drag-highlight");
      }
    });

    if (isDragging && firstCell) {
      const countContainer = firstCell.querySelector(".selection-count");
      countContainer.textContent = countHighlighted || "";
    }
  }

  // Initial calendar setup
  updateCalendar();
});
