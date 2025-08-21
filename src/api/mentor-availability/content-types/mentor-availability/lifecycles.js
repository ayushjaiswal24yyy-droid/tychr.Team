module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;
    await validateSlots(data, null, event); // null for id since it's a new record
  },

  async beforeUpdate(event) {
    const { data, where } = event.params;
    const recordId = where.id;
    await validateSlots(data, recordId, event);
  }
};

async function validateSlots(data, currentRecordId, event) {
  const days = data.days || [];
  const mentorId = data.mentor;
  
  if (!mentorId) {
    // If no mentor ID is provided, only validate internal slots
    validateInternalSlots(days);
    return;
  }

  // Get existing records for the same mentor (excluding current record if updating)
  const existingQuery = {
    where: {
      mentor: mentorId,
    },
  };
  
  // Exclude current record when updating
  if (currentRecordId) {
    existingQuery.where.id = { $ne: currentRecordId };
  }

  const existingRecords = await strapi.entityService.findMany(
    event.model.uid,
    existingQuery
  );

  // First validate internal slots (within the same record)
  validateInternalSlots(days);

  // Then validate against existing records
  await validateAgainstExisting(days, existingRecords);
}

function validateInternalSlots(days) {
  for (const day of days) {
    // Skip validation for disabled days or days without slots
    if (!day.enabled || !day.slots || day.slots.length === 0) continue;

    const slots = day.slots;
    const seenSlots = new Set();
    const sortedSlots = slots.slice().sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

    for (let i = 0; i < sortedSlots.length; i++) {
      const slot = sortedSlots[i];
      if (!slot.start || !slot.end) {
        throw new Error(`Invalid slot in ${day.day}: missing start or end time.`);
      }

      // Validate start < end
      if (timeToMinutes(slot.start) >= timeToMinutes(slot.end)) {
        throw new Error(`Invalid slot in ${day.day}: start time must be before end time (${slot.start} - ${slot.end}).`);
      }

      // Check duplicate (exact match)
      const slotKey = `${slot.start}:${slot.end}`;
      if (seenSlots.has(slotKey)) {
        throw new Error(`Duplicate slot found in ${day.day}: ${slot.start} - ${slot.end}`);
      }
      seenSlots.add(slotKey);

      // Check overlap with next slot
      if (i < sortedSlots.length - 1) {
        const nextSlot = sortedSlots[i + 1];
        if (timeToMinutes(slot.end) > timeToMinutes(nextSlot.start)) {
          throw new Error(`Overlapping slots found in ${day.day}: ${slot.start} - ${slot.end} overlaps with ${nextSlot.start} - ${nextSlot.end}`);
        }
      }
    }
  }
}

async function validateAgainstExisting(newDays, existingRecords) {
  // Create a map of existing slots by day for efficient lookup
  const existingSlotsByDay = new Map();
  
  for (const record of existingRecords) {
    const recordDays = record.days || [];
    for (const day of recordDays) {
      // Skip disabled days or days without slots
      if (!day.enabled || !day.slots || day.slots.length === 0) continue;
      
      const dayName = day.day.toLowerCase(); // Ensure consistent case
      if (!existingSlotsByDay.has(dayName)) {
        existingSlotsByDay.set(dayName, []);
      }
      
      const slots = day.slots;
      for (const slot of slots) {
        if (slot.start && slot.end) {
          existingSlotsByDay.get(dayName).push({
            start: slot.start,
            end: slot.end,
            startMinutes: timeToMinutes(slot.start),
            endMinutes: timeToMinutes(slot.end)
          });
        }
      }
    }
  }

  // Check new slots against existing ones
  for (const day of newDays) {
    // Skip validation for disabled days or days without slots
    if (!day.enabled || !day.slots || day.slots.length === 0) continue;

    const dayName = day.day.toLowerCase(); // Ensure consistent case
    const newSlots = day.slots;
    const existingSlots = existingSlotsByDay.get(dayName) || [];

    for (const newSlot of newSlots) {
      if (!newSlot.start || !newSlot.end) continue;

      const newStartMinutes = timeToMinutes(newSlot.start);
      const newEndMinutes = timeToMinutes(newSlot.end);

      for (const existingSlot of existingSlots) {
        // Check for exact duplicate
        if (newSlot.start === existingSlot.start && newSlot.end === existingSlot.end) {
          throw new Error(`Duplicate slot found for ${day.day}: ${newSlot.start} - ${newSlot.end} already exists for this mentor`);
        }

        // Check for overlap
        // Two slots overlap if: newStart < existingEnd AND newEnd > existingStart
        if (newStartMinutes < existingSlot.endMinutes && newEndMinutes > existingSlot.startMinutes) {
          throw new Error(`Overlapping slot found for ${day.day}: ${newSlot.start} - ${newSlot.end} overlaps with existing slot ${existingSlot.start} - ${existingSlot.end} for this mentor`);
        }
      }
    }
  }
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}