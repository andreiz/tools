const DateRange = {
  create: function(start, end, label, color) {
    return {
      id: Date.now().toString(), // unique identifier
      start: parseInt(start),
      end: parseInt(end),
      label: label,
      color: color || this.getRandomPastelColor()
    };
  },

  // Generate a random pastel color for range highlighting
  getRandomPastelColor: function() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 90%)`;
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const monthPicker = document.getElementById("monthPicker");
  const yearPicker = document.getElementById("yearPicker");
  const todayButton = document.getElementById("todayButton");

  let isDragging = false;
  let selectionStart = null;
  let selectionEnd = null;
  let firstCell = null;
  let savedRanges = [];

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
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
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
    // Convert so that Monday = 0, Sunday = 6
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

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Function to create weekday labels
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

  function updateRangeDisplay() {
    // Clear all existing highlights and labels
    document.querySelectorAll("#selectedMonth .calendar-day").forEach(dayCell => {
      const day = dayCell.dataset.day;
      if (!day) return;

      const labelsContainer = dayCell.querySelector(".day-labels");
      labelsContainer.innerHTML = "";
      dayCell.style.backgroundColor = "";

      // Find all ranges that include this day
      const matchingRanges = savedRanges.filter(range => 
        day >= range.start && day <= range.end
      );

      // Apply highlights and labels
      matchingRanges.forEach(range => {
        // Only show label on first day of range
        if (parseInt(day) === range.start) {
          const label = document.createElement("div");
          label.className = "range-label";
          label.textContent = range.label;
          label.style.backgroundColor = range.color;
          label.setAttribute('data-range-id', range.id);
          
          // Add delete button
          const deleteBtn = document.createElement("button");
          deleteBtn.className = "delete-range";
          deleteBtn.innerHTML = "×";
          deleteBtn.onclick = (e) => {
            e.stopPropagation();
            savedRanges = savedRanges.filter(r => r.id !== range.id);
            saveRanges();
            updateRangeDisplay();
          };
          
          label.appendChild(deleteBtn);
          labelsContainer.appendChild(label);
        }

        // Apply highlight with reduced opacity for overlapping ranges
        const existingColor = dayCell.style.backgroundColor;
        if (!existingColor) {
          dayCell.style.backgroundColor = range.color;
        } else {
          // If already highlighted, make it slightly darker
          dayCell.style.backgroundColor = range.color;
          dayCell.style.opacity = "0.8";
        }
      });
    });
  }

  const updateCalendar = () => {
    const selectedMonth = parseInt(monthPicker.value);
    const selectedYear = parseInt(yearPicker.value);
    const lastDayInMonth = getDaysInMonth(selectedYear, selectedMonth);

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
      selectedYear,
      selectedMonth - 1
    );

    // Calculate and update the next month
    const nextMonthDate = new Date(selectedYear, selectedMonth + 1, 1);
    updateMonth(
      nextMonthDate.getFullYear(),
      nextMonthDate.getMonth(),
      "nextMonth"
    );
    document.getElementById("nextMonthLabel").textContent = getMonthNameAndYear(
      selectedYear,
      selectedMonth + 1
    );

    const selectedContainer = document.getElementById("selectedMonth");
    selectedContainer.addEventListener("mousedown", (e) => {
      // Check if the primary (left) mouse button is pressed
      if (e.button === 0) {
        const targetDay = e.target.closest(".calendar-day");
        if (targetDay) {
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
        // If over a valid day cell
        if (targetDay && targetDay.dataset.day) {
          selectionEnd = targetDay.dataset.day;
        } else {
          // Check if selectionEnd is null before attempting numerical comparison
          if (selectionEnd === null) {
            // If selectionEnd is null, we're at the start of the drag
            // Decide on setting to first or last day based on additional logic or default behavior
            selectionEnd = lastDayInMonth.toString(); // Default to last day or implement additional logic
          } else {
            // Convert selectionStart and selectionEnd to integers for comparison
            const start = parseInt(selectionStart, 10);
            const end = parseInt(selectionEnd, 10);
            const isDraggingToEnd = start <= end;
            selectionEnd = isDraggingToEnd ? lastDayInMonth.toString() : "1";
          }
        }
        updateSelectionHighlights();
      }
    });

    selectedContainer.addEventListener("dragstart", (e) => {
      e.preventDefault();
    });

    updateRangeDisplay();
  };

  const updateMonth = (year, month, elementId) => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const leadingEmptyCells = firstDay - 1; // Assuming week starts on Monday (1)
    const totalDaysDisplayed = leadingEmptyCells + daysInMonth + 1;
    const today = new Date();
    const isCurrentMonth =
      today.getFullYear() === year && today.getMonth() === month;

    // Calculate the number of trailing empty cells needed to complete the final row
    const trailingEmptyCells = (7 - (totalDaysDisplayed % 7)) % 7;

    const monthElement = document.getElementById(elementId);
    clearCalendar(monthElement);
    createWeekdayLabels(monthElement);

    // create cells for each day
    for (let i = 0; i < firstDay; i++) {
      monthElement.appendChild(createCalendarDay(null));
    }

    for (let i = 1; i <= daysInMonth; i++) {
      var cell = monthElement.appendChild(createCalendarDay(i));
      if (isCurrentMonth) {
        if (i === today.getDate()) {
          cell.classList.add("today-highlight");
        }
      }
      cell.setAttribute("data-day", i);
    }

    for (let i = 0; i < trailingEmptyCells; i++) {
      monthElement.appendChild(createCalendarDay(null));
    }
  };

  monthPicker.addEventListener("change", updateCalendar);
  yearPicker.addEventListener("change", updateCalendar);
  todayButton.addEventListener("click", () => {
    const today = new Date();
    monthPicker.value = today.getMonth().toString();
    yearPicker.value = today.getFullYear().toString();
    updateCalendar();
  });

  const clearRangesButton = document.getElementById("clearRangesButton");

  clearRangesButton.addEventListener("click", () => {
      // Clear the arrays and storage
      savedRanges = [];
      localStorage.removeItem('calendarRanges');
      
      // Clear all visual highlights and labels
      document.querySelectorAll("#selectedMonth .calendar-day").forEach(dayCell => {
          const labelsContainer = dayCell.querySelector(".day-labels");
          if (labelsContainer) {
              labelsContainer.innerHTML = "";
          }
          dayCell.style.backgroundColor = "";
          dayCell.style.opacity = "1";
      });
  });

  updateCalendar(); // Initial calendar setup

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      if (firstCell) {
        const countContainer = firstCell.querySelector(".selection-count");
        countContainer.textContent = ""; // Clear count
        firstCell = null;
      }
      // Optionally, clear the selection or perform an action with the selected range here
      // For example, resetting selectionStart and selectionEnd
      selectionStart = selectionEnd = null;
      updateSelectionHighlights(); // Clear highlights or keep, depending on your app's logic
    }
  });
  // Modify the mouseup event listener
  document.addEventListener("mouseup", finalizeDateRange);

  function updateSelectionHighlights() {
    let countHighlighted = 0;
    document
      .querySelectorAll("#selectedMonth .calendar-day")
      .forEach((dayCell) => {
        const day = dayCell.dataset.day;
        const start = Math.min(selectionStart, selectionEnd); // Ensure correct order
        const end = Math.max(selectionStart, selectionEnd);
        countHighlighted = end - start + 1;
        if (day >= start && day <= end) {
          dayCell.classList.add("drag-highlight");
        } else {
          dayCell.classList.remove("drag-highlight");
        }
      });

    // Update the counter in the first cell if dragging
    if (isDragging && firstCell) {
      const countContainer = firstCell.querySelector(".selection-count");
      countContainer.textContent = countHighlighted; // Display count
    }
  }

  async function finalizeDateRange() {
    if (selectionStart && selectionEnd) {
      try {
        const label = await createLabelInput(
          Math.min(selectionStart, selectionEnd),
          Math.max(selectionStart, selectionEnd)
        );
        
        const newRange = DateRange.create(
          Math.min(selectionStart, selectionEnd),
          Math.max(selectionStart, selectionEnd),
          label
        );
        
        savedRanges.push(newRange);
        saveRanges();
        updateRangeDisplay();
      } catch (e) {
        // User cancelled label input
      }
    }
    
    // Reset selection
    isDragging = false;
    selectionStart = null;
    selectionEnd = null;
    firstCell = null;
    document.querySelectorAll(".drag-highlight").forEach(cell => {
      cell.classList.remove("drag-highlight");
    });
  }
});
