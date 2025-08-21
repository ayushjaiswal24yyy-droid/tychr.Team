module.exports = {
  beforeCreate(event) {
    const { data } = event.params;
    validateSlots(data);
  },

  beforeUpdate(event) {
    const { data } = event.params;
    validateSlots(data);
  }
};

function validateSlots(data) {
  const days = data.days || [];
  for (const day of days) {
    const slots = day.slots || [];
    if (slots.length === 0) continue;

    // Check for duplicates and overlaps
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

function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}