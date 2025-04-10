let sampleIgcUrls = [];

async function fetchSampleUrls() {
  const endpoint = "https://script.google.com/macros/s/AKfycbyO3emcw9VU4U1AYuhCUjEB4NwC_qC9cjYNFxNCPc7c8ks_0WJPCxu0YId56txuFBCm/exec"; // Thay link thực tế ở đây

  try {
    const response = await fetch(endpoint);
    const data = await response.json();
    sampleIgcUrls = data.urls || [];
    addSampleUrlSuggestions(); // Gọi sau khi có dữ liệu
  } catch (err) {
    console.error("Lỗi khi tải danh sách URL từ Google Sheets:", err);
  }
}

function addSampleUrlSuggestions() {
  if (!sampleIgcUrls.length) return;

  const urlInput = document.getElementById('igcUrl');
  const cardBody = urlInput.closest('.card-body');
  if (!cardBody) return;

  const sampleUrlsDiv = document.createElement('div');
  sampleUrlsDiv.className = 'mt-3';

  const sampleUrlsHeading = document.createElement('p');
  sampleUrlsHeading.className = 'small text-muted mb-1';
  sampleUrlsHeading.textContent = 'Sample IGC URLs for testing:';
  sampleUrlsDiv.appendChild(sampleUrlsHeading);

  const sampleUrlsList = document.createElement('div');
  sampleUrlsList.className = 'sample-urls d-flex flex-column gap-1';

  sampleIgcUrls.forEach((url, index) => {
    const urlButton = document.createElement('button');
    urlButton.className = 'btn btn-sm btn-outline-secondary text-start overflow-hidden';
    urlButton.style.textOverflow = 'ellipsis';
    urlButton.style.whiteSpace = 'nowrap';
    urlButton.textContent = `Sample ${index + 1}`;
    urlButton.title = url;

    urlButton.addEventListener('click', () => {
      urlInput.value = url;
      document.getElementById('loadIgcBtn').click();
    });

    sampleUrlsList.appendChild(urlButton);
  });

  sampleUrlsDiv.appendChild(sampleUrlsList);
  cardBody.appendChild(sampleUrlsDiv);
}

document.addEventListener('DOMContentLoaded', fetchSampleUrls);
