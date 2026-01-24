document.addEventListener("DOMContentLoaded", () => {
  const monthPicker = document.getElementById("monthPicker");
  const yearPicker = document.getElementById("yearPicker");
  const todayButton = document.getElementById("todayButton");
  const colorPicker = window.ColorPicker;

  let isDragging = false;
  let selectionStart = null;
  let selectionEnd = null;
  let firstCell = null;
  let savedRanges = [];

  const DateRange = {
    create: function(startDate, endDate, label, color) {
      // Set time to midnight for start and 23:59:59.999 for end
      startDate.setHours(0, 0, 0, 0);
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

    getDistinctHueColor: function(startDate, endDate) {
      const selectedMonth = parseInt(monthPicker.value, 10);
      const selectedYear = parseInt(yearPicker.value, 10);
      return colorPicker.pickDistinctHueForMonth(savedRanges, selectedYear, selectedMonth);
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

  function createCalendarDay(day, year, month) {
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
      cell.setAttribute("data-year", year);
      cell.setAttribute("data-month", month);
    }
    return cell;
  }

  function createLabelInput(start, end) {
    const modal = document.createElement("div");
    modal.className = "label-modal";

    const selectedMonth = parseInt(monthPicker.value);
    const selectedYear = parseInt(yearPicker.value);
    const startDate = new Date(selectedYear, selectedMonth, parseInt(start));
    const endDate = new Date(selectedYear, selectedMonth, parseInt(end));
    const duration = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    modal.innerHTML = `
      <div class="label-modal-content">
        <h3>Add Label for Selected Range</h3>
        <div class="date-controls">
          <div class="dates-container">
            <div class="date-row">
              <div class="date-label">Start:</div>
              <div class="date-value">${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</div>
            </div>
            <div class="date-row">
              <div class="date-label">End:</div>
              <div class="date-value">${endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</div>
            </div>
          </div>
          <div class="duration-control">
            <label>Duration:</label>
            <input type="number"
                  id="rangeDuration"
                  value="${duration}"
                  min="1"
                  class="duration-input">
            <span>days</span>
          </div>
        </div>
        <input type="text" id="rangeLabel" placeholder="Enter label" class="range-label-input">
        <div class="modal-buttons">
          <button id="saveLabelBtn" class="primary-button">Save</button>
          <button id="cancelLabelBtn" class="secondary-button">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector("#rangeLabel");
    const durationInput = modal.querySelector("#rangeDuration");
    const saveBtn = modal.querySelector("#saveLabelBtn");
    const cancelBtn = modal.querySelector("#cancelLabelBtn");
    const endDateValue = modal.querySelector(".date-row:nth-child(2) .date-value");

    // Handle duration changes
    durationInput.addEventListener("input", () => {
      const newDuration = parseInt(durationInput.value) || 1;
      const newEndDate = new Date(startDate);
      newEndDate.setDate(startDate.getDate() + newDuration - 1);
      endDate.setTime(newEndDate.getTime());

      endDateValue.textContent = newEndDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric'
      });
    });

    return new Promise((resolve, reject) => {
      saveBtn.addEventListener("click", () => {
        const label = input.value.trim();
        if (label) {
          modal.remove();
          resolve({
            label,
            startDate,
            endDate
          });
        }
      });

      cancelBtn.addEventListener("click", () => {
        modal.remove();
        reject();
      });

      input.addEventListener("keyup", (e) => {
        if (e.key === "Enter" && input.value.trim()) {
          modal.remove();
          resolve({
            label: input.value.trim(),
            startDate,
            endDate
          });
        } else if (e.key === "Escape") {
          modal.remove();
          reject();
        }
      });

      input.focus();
    });
  }

  function findMatchingRanges(cellDate) {
    const ranges = savedRanges.filter(range => {
      const startDate = new Date(range.startDate);
      const endDate = new Date(range.endDate);
      return cellDate >= startDate && cellDate <= endDate;
    });
    return ranges;
  }

  // Create a shared function for applying range styling
  function applyRangeStyling(dayCell, matchingRanges, isSmallMonth = false) {
    if (matchingRanges.length > 1) {
      const gradientColors = matchingRanges.map(r => r.color);
      dayCell.style.background = `linear-gradient(45deg, ${gradientColors.join(', ')})`;
    } else if (matchingRanges.length === 1) {
      dayCell.style.backgroundColor = matchingRanges[0].color;
    }

    const year = parseInt(dayCell.dataset.year);
    const month = parseInt(dayCell.dataset.month);
    const day = parseInt(dayCell.dataset.day);

    matchingRanges.forEach(range => {
      const startDate = new Date(range.startDate);
      const endDate = new Date(range.endDate);

      const isStart = startDate.getDate() === day &&
                     startDate.getMonth() === month &&
                     startDate.getFullYear() === year;
      const isEnd = endDate.getDate() === day &&
                   endDate.getMonth() === month &&
                   endDate.getFullYear() === year;

      if (isStart) {
        dayCell.classList.add('range-start');

        // Add label for range start in both main and small months
        const labelsContainer = dayCell.querySelector(".day-labels");
        if (isSmallMonth) {
          const label = document.createElement("div");
          label.className = "small-month-label";
          label.textContent = range.label;
          labelsContainer.appendChild(label);
        } else {
          const label = document.createElement("div");
          label.className = "range-label";
          label.textContent = range.label;
          label.style.backgroundColor = range.color;
          label.setAttribute('data-range-id', range.id);

          // Only add delete button in main month view
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
            updateRangesAndUI();
          });

          label.appendChild(deleteBtn);
          labelsContainer.appendChild(label);
        }
      }

      if (isEnd) {
        dayCell.classList.add('range-end');
      }

      // Add continuation indicators
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);

      if (day === 1 && startDate < firstDayOfMonth) {
        dayCell.classList.add('range-continues-left');
      }

      if (day === lastDayOfMonth.getDate() && endDate > lastDayOfMonth) {
        dayCell.classList.add('range-continues-right');
      }
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
        const startDay = Math.min(parseInt(selectionStart, 10), parseInt(selectionEnd, 10));
        const endDay = Math.max(parseInt(selectionStart, 10), parseInt(selectionEnd, 10));

        const result = await createLabelInput(startDay, endDay);
        const newRange = DateRange.create(result.startDate, result.endDate, result.label);

        savedRanges = [...savedRanges, newRange];
        updateRangesAndUI();
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
    const isSmallMonth = elementId !== "selectedMonth";

    const monthElement = document.getElementById(elementId);
    clearCalendar(monthElement);
    createWeekdayLabels(monthElement);

    // Create empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      monthElement.appendChild(createCalendarDay(null, year, month));
    }

    // Create cells for each day of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const cell = monthElement.appendChild(createCalendarDay(i, year, month));
      if (isCurrentMonth && i === today.getDate()) {
        cell.classList.add("today-highlight");
      }

      // Clear any existing styling
      cell.style.backgroundColor = "";
      cell.style.background = "";
      cell.classList.remove('range-start', 'range-end', 'range-continues-left', 'range-continues-right');
      const labelsContainer = cell.querySelector(".day-labels");
      labelsContainer.innerHTML = "";

      // Add range display for all month views
      const cellDate = new Date(year, month, i);
      cellDate.setHours(12, 0, 0, 0);
      const matchingRanges = findMatchingRanges(cellDate);
      applyRangeStyling(cell, matchingRanges, isSmallMonth);
    }

    // Create empty cells to complete the last week if needed
    const totalDays = firstDay + daysInMonth;
    const remainingCells = (7 - (totalDays % 7)) % 7;
    for (let i = 0; i < remainingCells; i++) {
      monthElement.appendChild(createCalendarDay(null, year, month));
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
  
  // Navigation button handlers
  document.getElementById("prevMonthBtn").addEventListener("click", () => {
    const currentMonth = parseInt(monthPicker.value);
    const currentYear = parseInt(yearPicker.value);
    
    if (currentMonth === 0) {
      monthPicker.value = "11";
      yearPicker.value = (currentYear - 1).toString();
    } else {
      monthPicker.value = (currentMonth - 1).toString();
    }
    updateCalendar();
  });

  document.getElementById("nextMonthBtn").addEventListener("click", () => {
    const currentMonth = parseInt(monthPicker.value);
    const currentYear = parseInt(yearPicker.value);
    
    if (currentMonth === 11) {
      monthPicker.value = "0";
      yearPicker.value = (currentYear + 1).toString();
    } else {
      monthPicker.value = (currentMonth + 1).toString();
    }
    updateCalendar();
  });

  todayButton.addEventListener("click", () => {
    const today = new Date();
    monthPicker.value = today.getMonth().toString();
    yearPicker.value = today.getFullYear().toString();
    updateCalendar();
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

  async function exportRanges() {
    const dataStr = JSON.stringify(savedRanges, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });

    try {
      // Use the File System Access API if available
      if ('showSaveFilePicker' in window) {
        const opts = {
          suggestedName: 'calendar-ranges.json',
          types: [{
            description: 'JSON File',
            accept: {
              'application/json': ['.json'],
            },
          }],
          startIn: 'documents',
          id: 'calendarRanges'
        };

        const handle = await window.showSaveFilePicker(opts);
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        // Show filename dialog for browsers without File System Access API
        const filename = await showFilenameDialog();

        // If user didn't cancel, proceed with download
        if (filename) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error saving file:', err);
        alert('Error saving file: ' + err.message);
      }
    }
  }

  function importRanges(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const importedRanges = JSON.parse(e.target.result);

        if (!Array.isArray(importedRanges)) {
          throw new Error('Invalid format: Expected an array');
        }

        // Validate each range object
        importedRanges.forEach(range => {
          if (!range.id || !range.startDate || !range.endDate || !range.label || !range.color) {
            throw new Error('Invalid range format');
          }
          // Validate dates
          new Date(range.startDate);
          new Date(range.endDate);
        });

        const importCount = importedRanges.length;
        if (importCount === 0) {
          alert('No ranges found in file');
          return;
        }

        savedRanges = [...savedRanges, ...importedRanges];
        updateRangesAndUI();

        alert(`Successfully imported ${importCount} range${importCount === 1 ? '' : 's'}`);
      } catch (error) {
        alert('Error importing ranges: ' + error.message);
      }
    };
    reader.readAsText(file);
  }

  function showFilenameDialog() {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
      modal.style.zIndex = '1000';

      const dialog = document.createElement('div');
      dialog.className = 'bg-white rounded-lg p-6 max-w-sm mx-4';
      dialog.innerHTML = `
        <h3 class="text-lg font-bold mb-4">Save As</h3>
        <div class="mb-4">
          <input type="text"
                 id="filenameInput"
                 value="calendar-ranges.json"
                 class="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500">
        </div>
        <div class="flex justify-end gap-3">
          <button class="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300" id="cancelSave">Cancel</button>
          <button class="px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white" id="confirmSave">Save</button>
        </div>
      `;

      modal.appendChild(dialog);
      document.body.appendChild(modal);

      // Focus the input and select filename (without extension)
      const input = dialog.querySelector('#filenameInput');
      input.focus();
      input.setSelectionRange(0, input.value.lastIndexOf('.'));

      const handleCancel = () => {
        document.body.removeChild(modal);
        resolve(null);
      };

      const handleConfirm = () => {
        const filename = input.value.trim();
        if (filename) {
          document.body.removeChild(modal);
          resolve(filename);
        } else {
          input.focus();
        }
      };

      // Close on background click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) handleCancel();
      });

      // Handle Enter and Escape keys
      dialog.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleConfirm();
        } else if (e.key === 'Escape') {
          handleCancel();
        }
      });

      dialog.querySelector('#cancelSave').addEventListener('click', handleCancel);
      dialog.querySelector('#confirmSave').addEventListener('click', handleConfirm);
    });
  }

  function updateExportButtonState() {
    const exportButton = document.getElementById('exportBtn');
    if (exportButton) {
      exportButton.disabled = savedRanges.length === 0;
    }
  }

  // Function to set up the import/export UI
  function setupImportExport() {
    // Find the top controls container
    const controlsContainer = document.querySelector('.flex.justify-end.items-center.mb-4');
    controlsContainer.className = 'flex justify-between items-center mb-4';

    // Create left side container for import/export/clear
    const leftControls = document.createElement('div');
    leftControls.className = 'flex gap-2';

    // Create import button
    const importButton = document.createElement('button');
    importButton.textContent = 'Import';
    importButton.className = 'bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded';

    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        importRanges(e.target.files[0]);
        e.target.value = '';
      }
    });

    importButton.addEventListener('click', () => fileInput.click());

    // Create export button
    const exportButton = document.createElement('button');
    exportButton.id = 'exportBtn';
    exportButton.textContent = 'Export';
    exportButton.className = 'bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed';
    exportButton.addEventListener('click', exportRanges);
    exportButton.disabled = savedRanges.length === 0;

    // Create clear button
    const clearBtn = document.createElement('button');
    clearBtn.id = 'clearBtn';
    clearBtn.textContent = 'Clear';
    clearBtn.className = 'bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-red-600';

    // Create a styled confirmation dialog
    function showClearConfirmation() {
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
      modal.style.zIndex = '1000';

      const dialog = document.createElement('div');
      dialog.className = 'bg-white rounded-lg p-6 max-w-sm mx-4';
      dialog.innerHTML = `
        <h3 class="text-lg font-bold mb-4">Clear All Data?</h3>
        <p class="text-gray-600 mb-6">This will delete all saved ranges. This action cannot be undone.</p>
        <div class="flex justify-end gap-3">
          <button class="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300" id="cancelClear">Cancel</button>
          <button class="px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-white" id="confirmClear">Clear All</button>
        </div>
      `;

      modal.appendChild(dialog);
      document.body.appendChild(modal);

      // Handle clicks
      const handleCancel = () => {
        document.body.removeChild(modal);
      };

      const handleConfirm = () => {
        savedRanges = [];
        localStorage.removeItem('calendarRanges');
        updateRangesAndUI();
        document.body.removeChild(modal);
      };

      // Close on background click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) handleCancel();
      });

      // Close on Escape key
      document.addEventListener('keydown', function closeOnEscape(e) {
        if (e.key === 'Escape') {
          handleCancel();
          document.removeEventListener('keydown', closeOnEscape);
        }
      });

      dialog.querySelector('#cancelClear').addEventListener('click', handleCancel);
      dialog.querySelector('#confirmClear').addEventListener('click', handleConfirm);
    }

    clearBtn.addEventListener('click', showClearConfirmation);

    // Create right side container for existing controls
    const rightControls = document.createElement('div');
    rightControls.className = 'flex gap-2';

    // Move existing month/year controls to right side
    const existingControls = Array.from(controlsContainer.children);
    existingControls.forEach(control => {
      rightControls.appendChild(control);
    });

    // Add all buttons to left controls
    leftControls.appendChild(importButton);
    leftControls.appendChild(exportButton);
    leftControls.appendChild(clearBtn);
    leftControls.appendChild(fileInput);

    // Clear and rebuild controls container
    controlsContainer.innerHTML = '';
    controlsContainer.appendChild(leftControls);
    controlsContainer.appendChild(rightControls);
  }

  function updateRangesAndUI() {
    saveRanges();
    updateCalendar();
    updateExportButtonState();
  }

  setupImportExport();
  updateCalendar();
});
