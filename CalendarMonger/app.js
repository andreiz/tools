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
      return {
        id: Date.now().toString(),
        start: parseInt(start, 10),
        end: parseInt(end, 10),
        label: label,
        color: color || this.getDistinctHueColor(start, end)
      };
    },
  
    hasOverlap: function(range1, range2) {
      return !(range1.end < range2.start || range1.start > range2.end);
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
  
    getDistinctHueColor: function(start, end) {
      // Find overlapping ranges
      const overlappingRanges = savedRanges.filter(range => 
        this.hasOverlap(
          { start, end },
          { start: range.start, end: range.end }
        )
      );
  
      if (overlappingRanges.length === 0) {
        // If no overlaps, use a random pastel color
        return this.hslToHex(Math.floor(Math.random() * 360), 70, 90);
      }
  
      // Get existing hues
      const existingHues = overlappingRanges.map(range => 
        this.getHueFromColor(range.color)
      );
  
      // Find the largest gap in hues
      existingHues.sort((a, b) => a - b);
      
      let maxGap = 0;
      let gapStart = 0;
      
      // Check gaps between existing hues
      for (let i = 0; i < existingHues.length; i++) {
        const nextIndex = (i + 1) % existingHues.length;
        let gap = existingHues[nextIndex] - existingHues[i];
        if (gap < 0) gap += 360;
        
        if (gap > maxGap) {
          maxGap = gap;
          gapStart = existingHues[i];
        }
      }
  
      // If we have no large gaps between existing hues, use the complementary color
      // of the first overlapping range
      if (maxGap < 60 && existingHues.length === 1) {
        const newHue = (existingHues[0] + 180) % 360;
        return this.hslToHex(newHue, 70, 90);
      }
  
      // Use the middle of the largest gap
      const newHue = (gapStart + maxGap / 2) % 360;
      return this.hslToHex(Math.round(newHue), 70, 90);
    }
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
          console.log('Save button clicked with label:', label);  // Debug log
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

  // Modify the updateRangeDisplay function to show overlap indicators
  function updateRangeDisplay() {
    document.querySelectorAll("#selectedMonth .calendar-day").forEach(dayCell => {
      const day = dayCell.dataset.day;
      if (!day) return;

      // Clear all existing content and styling
      const labelsContainer = dayCell.querySelector(".day-labels");
      labelsContainer.innerHTML = "";
      dayCell.style.backgroundColor = "";
      dayCell.style.background = ""; // Clear any existing gradients
      dayCell.style.opacity = "1";

      // Remove any existing overlap indicators
      const existingIndicator = dayCell.querySelector(".overlap-indicator");
      if (existingIndicator) {
        existingIndicator.remove();
      }

      const matchingRanges = savedRanges.filter(range => 
        parseInt(day) >= range.start && parseInt(day) <= range.end
      );

      // Only add overlap indicator and gradient if there are multiple ranges
      if (matchingRanges.length > 1) {
        const overlapIndicator = document.createElement("div");
        overlapIndicator.className = "overlap-indicator";
        overlapIndicator.innerHTML = "⋒";
        dayCell.appendChild(overlapIndicator);

        // Apply gradient background for multiple ranges
        const gradientColors = matchingRanges.map(r => r.color);
        dayCell.style.background = `linear-gradient(45deg, ${gradientColors.join(', ')})`;
      } else if (matchingRanges.length === 1) {
        // Single range - just use solid background
        dayCell.style.backgroundColor = matchingRanges[0].color;
      }

      matchingRanges.forEach(range => {
        if (parseInt(day) === range.start) {
          const label = document.createElement("div");
          label.className = "range-label";
          label.textContent = range.label;
          label.style.backgroundColor = range.color;
          label.setAttribute('data-range-id', range.id);

          const deleteBtn = document.createElement("button");
          deleteBtn.className = "delete-range";
          deleteBtn.innerHTML = "×";

          // Existing delete button event handlers
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
        // Clear all selection-related UI elements
        isDragging = false;
        selectionStart = null;
        selectionEnd = null;

        // Clear the count display explicitly
        document.querySelectorAll(".selection-count").forEach(counter => {
            counter.textContent = "";
        });

        // Remove highlights
        document.querySelectorAll(".drag-highlight").forEach(cell => {
            cell.classList.remove("drag-highlight");
        });

        firstCell = null;
    };

    if (selectionStart && selectionEnd) {
        try {
            const start = Math.min(parseInt(selectionStart, 10), parseInt(selectionEnd, 10));
            const end = Math.max(parseInt(selectionStart, 10), parseInt(selectionEnd, 10));

            const label = await createLabelInput(start, end);
            const newRange = DateRange.create(start, end, label);

            savedRanges.push(newRange);
            saveRanges();
            updateRangeDisplay();
        } catch (e) {
            console.error('Error in finalizeDateRange:', e);
        } finally {
            // Clear UI regardless of success or failure
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
