document.addEventListener("DOMContentLoaded", () => {
  const monthPicker = document.getElementById("monthPicker");
  const yearPicker = document.getElementById("yearPicker");
  const todayButton = document.getElementById("todayButton");

  let isDragging = false;
  let selectionStart = null;
  let selectionEnd = null;
  let firstCell = null;

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
      cell.className = "calendar-day";
      const dayNumber = document.createElement("div");
      dayNumber.className = "day-number";
      dayNumber.textContent = day;
      cell.appendChild(dayNumber);

      const dayCount = document.createElement("div");
      dayCount.className = "selection-count";
      cell.appendChild(dayCount);
    }
    return cell;
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
});
