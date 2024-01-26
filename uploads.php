<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Uploaded Photos</title>
    <style>
        /* Add styling for the images if needed */
        img {
            max-width: 100%;
            height: auto;
            margin: 10px;
        }
    </style>
</head>
<body>

<?php
$uploadsDirectory = 'uploads/';

// Get all files in the "uploads" directory
$files = scandir($uploadsDirectory);

// Display images
foreach ($files as $file) {
    // Check if the file is an image (you may want to enhance this check based on your specific file types)
    if (is_file($uploadsDirectory . $file) && in_array(pathinfo($file, PATHINFO_EXTENSION), ['jpg', 'jpeg', 'png', 'gif'])) {
        echo '<img src="' . $uploadsDirectory . $file . '" alt="' . $file . '">';
    }
}
?>

</body>
</html>
