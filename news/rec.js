function adjustShareOptionsPosition() {
    const shareOptions = document.querySelector('.share-options');
    const shareButton = document.querySelector('.round-share-button');
    const shareButtonRect = shareButton.getBoundingClientRect();

    // Set the left position of the share options container
    shareOptions.style.left = (shareButtonRect.left - shareOptions.offsetWidth - 10) + 'px';
}
// a
// Call the function initially to set the initial position of the share options
adjustShareOptionsPosition();


function toggleShareOptions() {
    var shareOptions = document.getElementById('shareOptions');
    shareOptions.style.display = (shareOptions.style.display === 'none' || shareOptions.style.display === '') ? 'block' : 'none';
}

// Function to fetch and display random images with titles and links
async function fetchAndDisplayRandomImagesWithTitlesAndLinks() {
    try {
        const response = await fetch('https://warrobotdoge.com/news');
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract all images with the class "image"
        const images = Array.from(doc.querySelectorAll('.image'));

        // Extract all titles with the class "title"
        const titles = Array.from(doc.querySelectorAll('.title')).map(title => title.textContent.trim());

        // Extract all links with the class "link"
        const links = Array.from(doc.querySelectorAll('.link')).map(link => link.href.trim());

        // Shuffle the order of images, titles, and links
        const shuffledIndexes = Array.from({ length: images.length }, (_, index) => index);
        shuffleArray(shuffledIndexes);

        // Create image containers with shuffled images, titles, and links
        for (let i = 0; i < 3; i++) {
            const containerElement = document.createElement('div');
            const imageElement = document.createElement('img');
            const titleElement = document.createElement('div');
            const linkElement = document.createElement('a');

            // Set attributes for image
            if (images[shuffledIndexes[i]]) {
                imageElement.src = images[shuffledIndexes[i]].src;
                imageElement.alt = 'WarRobotDoge News Image ' + (i + 1);
            } else {
                // If the image is not found, use placeholder attributes
                imageElement.src = 'path/to/placeholder-image.jpg'; // Replace with a placeholder image path
                imageElement.alt = 'Image Here';
            }
            imageElement.className = 'image'; // Add class for styling

            // Set text content and styling for title
            titleElement.className = 'image-title';
            titleElement.textContent = titles[shuffledIndexes[i]] || 'Title Not Found';

            // Set link attributes for both image and title
            linkElement.className = 'image-link';
            linkElement.href = links[shuffledIndexes[i]] || '#'; // Use # if the link is not found
            linkElement.target = '_blank'; // Open link in a new tab
            linkElement.rel = 'noopener noreferrer';

            // Append the image and title to the link
            linkElement.appendChild(imageElement);
            linkElement.appendChild(titleElement);

            // Append the link to the container
            containerElement.appendChild(linkElement);

            // Append the container to the main container
            document.getElementById('image-container').appendChild(containerElement);
        }
    } catch (error) {
        console.error('Error fetching and displaying images with titles and links:', error);
    }
}

// Call the function to fetch and display random images with titles and links on page load
fetchAndDisplayRandomImagesWithTitlesAndLinks();

// Function to fetch and display recommended articles
async function fetchAndDisplayRecommendedArticles() {
    try {
        // Assuming you have an endpoint for recommended articles, replace 'https://your-recommended-articles-endpoint' with the actual endpoint
        const response = await fetch('https://warrobotdoge.com/news');
        const data = await response.json();

        // Get the current article URL
        const currentArticleUrl = window.location.href;

        // Create and append recommendation items
        const recommendationContainer = document.querySelector('.recommendation');
        data.forEach(article => {
            // Check if the recommended article has the same link as the current article
            if (article.url !== currentArticleUrl) {
                const recommendationItem = document.createElement('div');
                recommendationItem.className = 'recommendation-item';

                const articleLink = document.createElement('a');
                articleLink.href = article.url;
                articleLink.title = article.title;

                const articleImage = document.createElement('img');
                articleImage.src = article.imageUrl;
                articleImage.alt = article.title;

                const articleTitle = document.createElement('h3');
                articleTitle.textContent = article.title;

                articleLink.appendChild(articleImage);
                articleLink.appendChild(articleTitle);
                recommendationItem.appendChild(articleLink);
                recommendationContainer.appendChild(recommendationItem);

                // Update the target attribute to '_self' after the link has been added to the DOM
                articleLink.target = '_self';
            }
        });
    } catch (error) {
        console.error('Error fetching and displaying recommended articles:', error);
    }
}

// Call the function to fetch and display recommended articles on page load
fetchAndDisplayRecommendedArticles();

// Function to shuffle an array (Fisher-Yates algorithm)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function shareOnFacebook() {
    // Get the text content under the class "article-sum"
    var articleSumText = document.querySelector('.article-sum').textContent;

    // Get the current page URL
    var currentUrl = window.location.href;

    // Combine the article text and current URL for the Facebook share
    var facebookShareText = articleSumText + ' ' + currentUrl;

    // Create the Facebook share URL with the combined text
    var facebookShareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(currentUrl) + '&quote=' + encodeURIComponent(facebookShareText);

    // Open Facebook in a new window for sharing
    window.open(facebookShareUrl);
}

function shareOnTwitter() {
    // Get the text content under the class "article-sum"
    var articleSumText = document.querySelector('.article-sum').textContent;

    // Get the current page URL
    var currentUrl = window.location.href;

    // Combine the article text and current URL for the tweet
    var tweetText = articleSumText + ' ' + currentUrl;

    // Create the Twitter intent URL with the tweet text
    var twitterIntentUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(tweetText);

    // Open Twitter in a new window and start composing a tweet
    window.open(twitterIntentUrl);
}

function shareOnEmail() {
    // Get the text content under the class "article-sum"
    var articleSumText = document.querySelector('.article-sum').textContent;

    // Get the current page URL
    var currentUrl = window.location.href;

    // Combine the article text and current URL for the email body
    var emailBody = articleSumText + '\n\n' + 'Read more: ' + currentUrl;

    // Create the mailto: link with the subject and body
    var mailtoLink = 'mailto:?subject=Check%20out%20this%20article%20on%20WarRobotDoge%20News&body=' + encodeURIComponent(emailBody);

    // Open the user's default email app
    window.location.href = mailtoLink;
}

var cookieEmoji = document.getElementById('cookieEmoji');

// Check if the cookie count exists in sessionStorage
var cookieCount = sessionStorage.getItem('cookieCount') || 0;

// If not added, add a click event listener to the 🍪 emoji
cookieEmoji.addEventListener('click', function () {
    // Check if the associated cookie exists
    if (sessionStorage.getItem('customCookie')) {
        alert('You already collected your cookie! 🍪');
    } else {
        // Increment the cookie count and display a message
        cookieCount++;
        alert('Cookie added for this article! 🍪 Total Cookies: ' + cookieCount);

        // Set the flag to indicate that the cookie has been added for this article
        sessionStorage.setItem('customCookie', 'true');

        // Update the cookie count in sessionStorage
        sessionStorage.setItem('cookieCount', cookieCount);
    }
});
