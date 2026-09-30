-- Rename existing customer 'Rahul Sharma' to 'Khushi Sharma'
UPDATE customers 
SET name = REPLACE(name, 'Rahul', 'Khushi'),
    email = REPLACE(email, 'rahul', 'khushi')
WHERE email LIKE '%rahul%';

-- Also update the AppUser login mapping
UPDATE users
SET username = REPLACE(username, 'rahul', 'khushi')
WHERE username LIKE '%rahul%';
