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
        color: color || this.getRandomPastelColor()
      };
    },

    getRandomPastelColor: function() {
      const hue = Math.floor(Math.random() * 360);
      return `hsl(${hue}, 70%, 90%)`;
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

  function updateRangeDisplay() {
    document.querySelectorAll("#selectedMonth .calendar-day").forEach(dayCell => {
        const day = dayCell.dataset.day;
        if (!day) return;

        const labelsContainer = dayCell.querySelector(".day-labels");
        labelsContainer.innerHTML = "";
        dayCell.style.backgroundColor = "";
        dayCell.style.opacity = "1";

        const matchingRanges = savedRanges.filter(range => 
            parseInt(day) >= range.start && parseInt(day) <= range.end
        );

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

                // Handle the mousedown event instead of click
                deleteBtn.addEventListener('mousedown', (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  e.stopImmediatePropagation();
                });

                // Also prevent mouseup from triggering calendar events
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

            dayCell.style.backgroundColor = range.color;
            if (matchingRanges.length > 1) {
                dayCell.style.opacity = "0.8";
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
