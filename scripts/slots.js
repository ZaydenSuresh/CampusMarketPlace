async function fetchSlots() {
  try {
    const response = await fetch('/slots');
    const slots = await response.json();
    displaySlots(slots);
  } catch (error) {
    console.error('Error fetching slots:', error);
  }
}

function displaySlots(slots) {
  const slotsContainer = document.getElementById('slots-container');

  if (!slotsContainer) return;

  slotsContainer.innerHTML = '';

  if (slots.length === 0) {
    slotsContainer.innerHTML = '<p>No available slots found.</p>';
    return;
  }

  slots.forEach(slot => {
    const slotCard = document.createElement('div');
    slotCard.className = 'slot-card';

    slotCard.innerHTML = `
      <p><strong>Time:</strong> ${slot.time}</p>
      <button data-id="${slot.id}">Book Slot</button>
    `;

    const button = slotCard.querySelector('button');
    button.addEventListener('click', () => bookSlot(slot.id));

    slotsContainer.appendChild(slotCard);
  });
}

async function bookSlot(slotId) {
  try {
    const response = await fetch(`/slots/book/${slotId}`, {
      method: 'POST'
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || 'Failed to book slot');
      return;
    }

    alert(result.message);
    fetchSlots();
  } catch (error) {
    console.error('Error booking slot:', error);
  }
}

document.addEventListener('DOMContentLoaded', fetchSlots);