-- phpMyAdmin SQL Dump
-- version 5.1.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Aug 06, 2023 at 06:54 PM
-- Server version: 8.0.28
-- PHP Version: 8.0.11

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `life`
--

-- --------------------------------------------------------

--
-- Table structure for table `exercise`
--

CREATE TABLE `exercise` (
  `exerciseId` varchar(36) NOT NULL,
  `title` varchar(100) NOT NULL,
  `description` varchar(255) NOT NULL,
  `difficulty` enum('Beginner','Intermediate','Advanced') NOT NULL DEFAULT 'Beginner',
  `muscleGroup` varchar(100) NOT NULL,
  `equipment` varchar(100) NOT NULL,
  `image` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `exercise`
--

INSERT INTO `exercise` (`exerciseId`, `title`, `description`, `difficulty`, `muscleGroup`, `equipment`, `image`) VALUES
('0641ed4a-9e59-4668-9f08-0ce970407bd7', 'Pull-ups', 'Upper body exercise targeting back, biceps, and shoulders.', 'Intermediate', 'Back, Biceps, Shoulders', 'Pull-up Bar', NULL),
('0c0c9808-a7a3-4569-8626-292a97143848', 'Romanian Deadlifts', 'Deadlift variation focusing on hamstrings and glutes.', 'Advanced', 'Hamstrings, Glutes', 'Barbell, Weight Plates', NULL),
('388bfa97-01c9-4365-a9c0-1453076bb31a', 'Tricep Dips', 'Bodyweight exercise targeting the triceps.', 'Intermediate', 'Triceps', 'Parallel Bars, Bench', NULL),
('39e59c5d-6470-424f-b96d-1082894c137a', 'Running', 'Great exercise', 'Beginner', 'Chest', 'None', NULL),
('3b1442d5-ce9b-4b02-ac1f-aad79a2ed937', 'Calf Raises', 'Isolation exercise targeting the calf muscles.', 'Beginner', 'Calves', 'Dumbbells, Smith Machine', NULL),
('40b16345-f1f5-4817-a55b-16e00016483a', 'Deadlifts', 'Compound exercise targeting back, glutes, hamstrings, and core.', 'Advanced', 'Back, Glutes, Hamstrings, Core', 'Barbell, Weight Plates', NULL),
('47313973-228b-47cd-ae1e-c92519bf0d10', 'Dips', 'Great exercise', 'Beginner', 'Triceps', 'None', NULL),
('4a9fad59-3a29-4fb0-9bde-4d2aa3848e22', 'Chin-ups', 'Similar to pull-ups but with an underhand grip.', 'Advanced', 'Back, Biceps, Shoulders', 'Pull-up Bar', NULL),
('528a8196-1fc9-4adc-9159-19ea6d7a0c75', 'Squats', 'Lower body exercise targeting quads, hamstrings, and glutes.', 'Beginner', 'Quadriceps, Hamstrings, Glutes', 'None', NULL),
('62f80abc-d330-4e14-af86-6f869a78a5dd', 'Russian Twists', 'Core exercise that involves twisting movements.', 'Beginner', 'Core', 'Medicine Ball, Dumbbell', NULL),
('71179076-d30d-47ec-83d0-680617a3c9bb', 'Bicep Curls', 'Isolation exercise targeting the biceps.', 'Beginner', 'Biceps', 'Dumbbells, Barbell', NULL),
('7bacdb89-a383-499e-84d3-3b38470e909d', 'Barbell Rows', 'Great exercise', 'Beginner', 'Chest', 'None', NULL),
('82e8c96b-c411-45a9-827a-70e998618c6b', 'Box Jumps', 'Explosive plyometric exercise targeting legs and glutes.', 'Intermediate', 'Legs, Glutes', 'Box', NULL),
('8992f4e5-5adc-4318-9681-95641e59e9f9', 'Dumbbell Press', 'Great exercise', 'Beginner', 'Chest', 'None', NULL),
('ae848a92-1349-48d5-839d-7005e447c1dc', 'Dips', 'Compound exercise targeting chest, shoulders, and triceps.', 'Intermediate', 'Chest, Shoulders, Triceps', 'Parallel Bars, Bench', NULL),
('b2c17a15-f18e-4b24-8071-94c2167d48b2', 'Bench Press', 'Great exercise', 'Beginner', 'Chest', 'None', NULL),
('cb069b4c-e0f0-4bfe-965a-87ab10ed20cd', 'Muscle Up', 'Great exercise', 'Beginner', 'Chest', 'None', NULL),
('cf96a35b-feb9-47ef-908d-a881a09e1795', 'Bench Press', 'Compound exercise targeting chest, shoulders, and triceps.', 'Intermediate', 'Chest, Shoulders, Triceps', 'Barbell, Bench, Weight Plates', NULL),
('d0776043-16b3-4399-8439-eeddd58b52b0', 'Push up', 'Great exercise', 'Beginner', 'Chest', 'None', NULL),
('d40b7bb6-12cc-4b45-8663-6bcd4822ffab', 'Leg Press', 'Machine-based exercise targeting the lower body.', 'Intermediate', 'Quadriceps, Hamstrings, Glutes', 'Leg Press Machine', NULL),
('d6b20d67-abdf-4c04-9019-b3a77afb2eb7', 'Burpees', 'Full-body exercise combining a squat, push-up, and jump.', 'Intermediate', 'Full Body', 'None', NULL),
('dcea35ec-ee3a-420a-9ca1-1be7fe9c7d9a', 'Lunges', 'Leg exercise targeting quads, hamstrings, and glutes.', 'Intermediate', 'Quadriceps, Hamstrings, Glutes', 'None', NULL),
('e0eae358-847c-4b19-9dbd-804f836e417d', 'Push-ups', 'Standard bodyweight exercise targeting chest, shoulders, and triceps.', 'Beginner', 'Chest, Shoulders, Triceps', 'None', NULL),
('e48a3a66-16b2-4d32-8db5-893def43a126', 'Hanging Leg Raises', 'Advanced core exercise performed while hanging.', 'Advanced', 'Core', 'Pull-up Bar', NULL),
('e4be1ad3-a0a9-4e3a-b9f4-e9714bd9ae92', 'Plank', 'Core exercise that helps improve stability and strength.', 'Beginner', 'Core', 'None', NULL),
('edfbbb93-f1b4-45e9-acb1-65b3f70f0b72', 'Mountain Climbers', 'Dynamic exercise that engages the core and legs.', 'Beginner', 'Core, Legs', 'None', NULL),
('f9566267-50eb-4301-b9d5-dfceadd72ec9', 'Dumbbell Shoulder Press', 'Shoulder exercise using dumbbells to target the deltoids.', 'Intermediate', 'Shoulders', 'Dumbbells', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `exercise_progress`
--

CREATE TABLE `exercise_progress` (
  `exerciseProgressId` varchar(36) NOT NULL,
  `date` varchar(10) NOT NULL,
  `sets` int NOT NULL,
  `reps` int NOT NULL,
  `weight` float NOT NULL,
  `userId` varchar(255) NOT NULL,
  `exerciseId` varchar(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `exercise_progress`
--

INSERT INTO `exercise_progress` (`exerciseProgressId`, `date`, `sets`, `reps`, `weight`, `userId`, `exerciseId`) VALUES
('007130c3-11b6-4120-be9c-a56b6478dcd3', '2023-08-06', 5, 21, 4, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', '47313973-228b-47cd-ae1e-c92519bf0d10'),
('067558a1-9291-47a0-87bb-9dd289f93590', '2023-08-06', 2, 12, 10, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', '388bfa97-01c9-4365-a9c0-1453076bb31a'),
('0b33bd58-6145-4849-9ee0-d4b83360f317', '2023-08-06', 3, 6, 60, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', 'b2c17a15-f18e-4b24-8071-94c2167d48b2'),
('0d27a6eb-2fbe-4e4e-8949-a65cd6808d7e', '2023-07-21', 5, 5, 20, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', 'd0776043-16b3-4399-8439-eeddd58b52b0'),
('5cbc6e07-e7cc-44ca-8a41-532870975b09', '2023-07-29', 3, 8, 40, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', '0641ed4a-9e59-4668-9f08-0ce970407bd7'),
('608556c9-2a35-444a-902d-00a34c13adc6', '2023-07-29', 2, 5, 100, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', '0641ed4a-9e59-4668-9f08-0ce970407bd7'),
('794829bc-c45e-4c94-84b0-ca3d83e2cc56', '2023-07-29', 5, 5, 10, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', '47313973-228b-47cd-ae1e-c92519bf0d10'),
('7d7aff31-5787-4873-955c-16cb51f6e061', '2023-07-21', 5, 5, 20, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', 'd0776043-16b3-4399-8439-eeddd58b52b0'),
('8418f0db-162e-42f4-9da8-f2316813b920', '2023-07-29', 0, 0, 0, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', '0641ed4a-9e59-4668-9f08-0ce970407bd7'),
('8cfaf269-6100-454d-a187-1fc0147cae0b', '2023-08-06', 3, 6, 60, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', '0641ed4a-9e59-4668-9f08-0ce970407bd7'),
('953a4e7d-8c2a-4f94-be97-def18b4a7602', '2023-07-29', 0, 0, 0, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', '0641ed4a-9e59-4668-9f08-0ce970407bd7'),
('9e201029-fe67-45a6-9df6-dfeccbd44a40', '2023-07-29', 3, 8, 40, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', '0641ed4a-9e59-4668-9f08-0ce970407bd7'),
('a21d400d-5d58-4878-9916-6330deec4956', '2023-07-29', 2, 8, 69, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', '0641ed4a-9e59-4668-9f08-0ce970407bd7'),
('c2d8d598-41f6-46b6-afff-8ee559f9af7a', '2023-07-21', 5, 5, 20, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', '7bacdb89-a383-499e-84d3-3b38470e909d'),
('caaf3ea1-c52c-4dc3-adf7-ce6809363789', '2023-07-21', 0, 0, 0, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', 'd0776043-16b3-4399-8439-eeddd58b52b0'),
('d9e0807a-9bea-4c55-a8f4-24286b8c912b', '2023-07-25', 0, 0, 0, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', '8992f4e5-5adc-4318-9681-95641e59e9f9'),
('e8d73b62-f79b-4975-a62e-71f9a08620cc', '2023-07-21', 5, 5, 20, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', '39e59c5d-6470-424f-b96d-1082894c137a'),
('eb84cd66-162f-471f-a6d7-89bf0a8bc644', '2023-07-21', 5, 5, 20, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', '39e59c5d-6470-424f-b96d-1082894c137a');

-- --------------------------------------------------------

--
-- Table structure for table `expense`
--

CREATE TABLE `expense` (
  `id` varchar(36) NOT NULL,
  `amount` float NOT NULL,
  `description` varchar(255) NOT NULL,
  `date` timestamp NOT NULL,
  `type` enum('expense','income') NOT NULL,
  `category` varchar(255) DEFAULT NULL,
  `balanceBeforeInteraction` int DEFAULT NULL,
  `walletId` varchar(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `expense`
--

INSERT INTO `expense` (`id`, `amount`, `description`, `date`, `type`, `category`, `balanceBeforeInteraction`, `walletId`) VALUES
('19be169b-64c7-4ef6-bdf2-6375a70c99d5', 33, 'twt', '2023-07-25 19:37:28', 'income', NULL, 1118, '6df5f4db-e564-47ab-a2c8-425d55394884'),
('1fdf7f59-99b5-4d33-9f33-efba80593e1e', 33, 'twt', '2023-07-25 19:37:16', 'expense', NULL, 1151, '6df5f4db-e564-47ab-a2c8-425d55394884'),
('3579cedb-46a5-4327-b6ab-f5bb087f96b2', 33, 'hhed', '2023-07-25 19:38:45', 'expense', NULL, 1150, '6df5f4db-e564-47ab-a2c8-425d55394884'),
('7cd72d34-67ed-4777-8b7a-2189833f1a73', 22, 'tt', '2023-07-25 19:40:39', 'expense', NULL, 1084, '6df5f4db-e564-47ab-a2c8-425d55394884'),
('9602713c-3ff3-4d4e-b5b1-a6424dae2a1a', 11, 'twts', '2023-07-25 19:36:19', 'expense', NULL, 1195, '6df5f4db-e564-47ab-a2c8-425d55394884'),
('d07852fd-8c57-4c55-a653-15b32554272f', 11, 'tetst', '2023-07-25 19:36:02', 'expense', NULL, 1206, '6df5f4db-e564-47ab-a2c8-425d55394884'),
('d2f601a0-3948-4ae1-91ef-578b99b11483', 33, '6eye6', '2023-07-25 19:35:52', 'expense', NULL, 1239, '6df5f4db-e564-47ab-a2c8-425d55394884'),
('d32a92d3-6095-465c-a7c1-6e0987995ffd', 33, 'tet', '2023-07-25 19:38:23', 'expense', NULL, 1183, '6df5f4db-e564-47ab-a2c8-425d55394884'),
('ea75675c-fb51-4e6b-882d-fd4d2ae6450b', 33, '77', '2023-07-25 19:38:11', 'income', NULL, 1150, '6df5f4db-e564-47ab-a2c8-425d55394884'),
('efcb5a0e-4396-40c4-97fd-323f1e34637b', 22, 'yeye', '2023-07-25 19:39:12', 'expense', NULL, 1106, '6df5f4db-e564-47ab-a2c8-425d55394884'),
('fd9ef74e-4f85-4567-ab85-4a06f0a63fa2', 33, 'twt', '2023-07-25 19:37:05', 'expense', NULL, 1184, '6df5f4db-e564-47ab-a2c8-425d55394884');

-- --------------------------------------------------------

--
-- Table structure for table `expense_file`
--

CREATE TABLE `expense_file` (
  `id` varchar(36) NOT NULL,
  `url` varchar(255) NOT NULL,
  `expenseId` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` varchar(36) NOT NULL,
  `token` varchar(60) NOT NULL,
  `userId` varchar(255) NOT NULL,
  `isEnable` tinyint NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `token`, `userId`, `isEnable`) VALUES
('879170e1-a900-42d2-8e65-36b3193aa9cc', 'ExponentPushToken[A5mRdpGdXGOK7B9YOeN7_S]', '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', 0);

-- --------------------------------------------------------

--
-- Table structure for table `reminder`
--

CREATE TABLE `reminder` (
  `id` varchar(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `userId` varchar(255) NOT NULL,
  `description` varchar(255) NOT NULL,
  `repeatEvery` int DEFAULT NULL,
  `exactDate` varchar(255) DEFAULT NULL,
  `isDone` tinyint NOT NULL DEFAULT '0',
  `isExactDate` tinyint NOT NULL DEFAULT '0',
  `repeat` tinyint NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `timeline`
--

CREATE TABLE `timeline` (
  `id` varchar(36) NOT NULL,
  `title` varchar(100) NOT NULL,
  `description` text NOT NULL,
  `date` text NOT NULL,
  `beginTime` time DEFAULT NULL,
  `endTime` time DEFAULT NULL,
  `isAllDay` tinyint NOT NULL DEFAULT '0',
  `isCompleted` tinyint NOT NULL DEFAULT '0',
  `notification` tinyint NOT NULL DEFAULT '1',
  `isPublic` tinyint NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `isRepeat` tinyint NOT NULL DEFAULT '0',
  `userId` varchar(255) NOT NULL,
  `tags` varchar(255) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `timeline`
--

INSERT INTO `timeline` (`id`, `title`, `description`, `date`, `beginTime`, `endTime`, `isAllDay`, `isCompleted`, `notification`, `isPublic`, `createdAt`, `updatedAt`, `isRepeat`, `userId`, `tags`) VALUES
('11fa49de-4a68-4d95-9827-0e21d3f48a2c', 'No title', '(no content)', '2023-07-18', '17:16:00', '18:16:00', 0, 0, 1, 0, '2023-07-18 15:16:47', '2023-07-18 15:16:47', 0, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', 'UNTAGGED'),
('324a6677-dd26-46dd-b94b-70d164354ea0', 'No title', '(no content)', '', '02:20:00', '03:20:00', 0, 0, 1, 0, '2023-08-06 00:22:32', '2023-08-06 00:22:32', 1, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', 'UNTAGGED'),
('7db3e403-5d57-4588-8c10-76917f402e6c', 'No title', '(no content)', '2023-07-25', '15:43:00', '16:43:00', 0, 0, 1, 0, '2023-07-25 13:43:55', '2023-07-25 13:43:55', 0, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', 'UNTAGGED'),
('97a4e2f6-7528-4cfc-b2d6-12eb19788117', 'No title', '(no content)\n\n\n\n\n\n\n', '2023-07-11', '16:38:00', '17:38:00', 0, 0, 1, 0, '2023-07-11 14:38:36', '2023-07-11 14:38:36', 0, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', 'UNTAGGED'),
('aecd72ce-280f-42e8-ac5b-1917b4f7fa30', 'Test event ', '(no content)', '2023-07-11', '16:35:00', '17:35:00', 0, 0, 1, 0, '2023-07-11 14:35:22', '2023-07-11 14:35:22', 0, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494', 'UNTAGGED');

-- --------------------------------------------------------

--
-- Table structure for table `timeline_files`
--

CREATE TABLE `timeline_files` (
  `id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `type` varchar(100) NOT NULL,
  `url` varchar(100) NOT NULL,
  `isPublic` tinyint NOT NULL DEFAULT '0',
  `timelineId` varchar(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `timeline_files`
--

INSERT INTO `timeline_files` (`id`, `name`, `createdAt`, `type`, `url`, `isPublic`, `timelineId`) VALUES
('d61871c8-35b7-4e89-a66e-bf3a8434e6f0', 'File', '2023-07-21 13:20:53', 'image/jpg', '4510da0b35f56be24adcac8bedc4f808', 0, 'aecd72ce-280f-42e8-ac5b-1917b4f7fa30'),
('ea1f4312-baa1-4735-abe6-59968e502793', 'File', '2023-07-25 15:22:03', 'image/jpg', '81626c5fe5c8a1f1e1bc3d0fc767cbcc', 0, '7db3e403-5d57-4588-8c10-76917f402e6c'),
('f5d13346-8952-4258-923c-12534d50a9ee', 'File', '2023-07-25 15:22:05', 'image/jpg', 'b60e94118d91f0a0cc60d384b39e7b72', 0, '7db3e403-5d57-4588-8c10-76917f402e6c');

-- --------------------------------------------------------

--
-- Table structure for table `timeline_todos`
--

CREATE TABLE `timeline_todos` (
  `id` varchar(36) NOT NULL,
  `title` varchar(100) NOT NULL,
  `isCompleted` tinyint NOT NULL DEFAULT '0',
  `timelineId` varchar(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `timeline_todos`
--

INSERT INTO `timeline_todos` (`id`, `title`, `isCompleted`, `timelineId`) VALUES
('6b23d174-c758-49e8-afbd-34945df22f79', 'Test task ', 1, '7db3e403-5d57-4588-8c10-76917f402e6c');

-- --------------------------------------------------------

--
-- Table structure for table `tips`
--

CREATE TABLE `tips` (
  `tipId` varchar(36) NOT NULL,
  `text` varchar(255) NOT NULL,
  `image` varchar(100) NOT NULL,
  `exerciseId` varchar(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` varchar(36) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `phone` int DEFAULT NULL,
  `firstName` varchar(60) NOT NULL DEFAULT '',
  `lastName` varchar(60) NOT NULL DEFAULT '',
  `age` int NOT NULL DEFAULT '0',
  `isVerified` tinyint NOT NULL DEFAULT '0',
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `isBlocked` tinyint NOT NULL DEFAULT '0',
  `is2Auth` tinyint NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `email`, `password`, `phone`, `firstName`, `lastName`, `age`, `isVerified`, `isDeleted`, `isBlocked`, `is2Auth`, `createdAt`) VALUES
('4eeef697-d22e-423c-a8e5-fd8dc4cc7494', 'kozakdamian73@gmail.com', '$2b$10$BgmrYe9NTeENMwMqW5J10OA4jPibHvous27mU5eo5riUsbiouW5J2', NULL, '', '', 0, 0, 0, 0, 0, '2023-07-11 13:00:45');

-- --------------------------------------------------------

--
-- Table structure for table `wallet`
--

CREATE TABLE `wallet` (
  `id` varchar(36) NOT NULL,
  `balance` float NOT NULL DEFAULT '0',
  `userId` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `wallet`
--

INSERT INTO `wallet` (`id`, `balance`, `userId`) VALUES
('6df5f4db-e564-47ab-a2c8-425d55394884', 1074, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494');

-- --------------------------------------------------------

--
-- Table structure for table `workout`
--

CREATE TABLE `workout` (
  `workoutId` varchar(36) NOT NULL,
  `title` varchar(100) NOT NULL,
  `description` varchar(255) NOT NULL,
  `type` enum('Cardio','Strength','Flexibility','PushPullLegs','FullBodyWorkout','Split','Other') NOT NULL DEFAULT 'Other',
  `difficulty` enum('Beginner','Intermediate','Advanced') NOT NULL DEFAULT 'Beginner',
  `isPublic` tinyint NOT NULL DEFAULT '0',
  `authorId` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `workout`
--

INSERT INTO `workout` (`workoutId`, `title`, `description`, `type`, `difficulty`, `isPublic`, `authorId`) VALUES
('736ec57d-0e4e-457a-bc99-53fc12434966', 'Ciupapi munuabui ', 'nsnsjsjdhhdhehehehehhe dhdhhehedjdjdjdjd idiruru idiruru jdjjdurufudjje djdjd', 'Flexibility', 'Intermediate', 0, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494'),
('ab7be36c-86fe-4f15-b5b0-2d8bc7372564', 'test workout 18.07', 'no meaningful description jdjdjdd djudjs', 'Cardio', 'Intermediate', 0, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494'),
('b217aada-66be-4388-b1cc-c2c59e22d2b8', 'empty workout yets ', 'create empty workout ', 'Cardio', 'Intermediate', 0, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494'),
('be770146-fbc6-4b42-8786-5bb7f47d0ebc', 'Test workout 11.07', 'test description ', 'Flexibility', 'Beginner', 0, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494'),
('f8b789f8-b5fd-4b17-9399-5f9316c4c4bc', 'adding yest ', 'test ', 'Cardio', 'Beginner', 0, '4eeef697-d22e-423c-a8e5-fd8dc4cc7494');

-- --------------------------------------------------------

--
-- Table structure for table `workout_exercises`
--

CREATE TABLE `workout_exercises` (
  `workoutWorkoutId` varchar(36) NOT NULL,
  `exerciseExerciseId` varchar(36) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `workout_exercises`
--

INSERT INTO `workout_exercises` (`workoutWorkoutId`, `exerciseExerciseId`) VALUES
('736ec57d-0e4e-457a-bc99-53fc12434966', '0641ed4a-9e59-4668-9f08-0ce970407bd7'),
('736ec57d-0e4e-457a-bc99-53fc12434966', '0c0c9808-a7a3-4569-8626-292a97143848'),
('736ec57d-0e4e-457a-bc99-53fc12434966', '39e59c5d-6470-424f-b96d-1082894c137a'),
('736ec57d-0e4e-457a-bc99-53fc12434966', '7bacdb89-a383-499e-84d3-3b38470e909d'),
('736ec57d-0e4e-457a-bc99-53fc12434966', '8992f4e5-5adc-4318-9681-95641e59e9f9'),
('736ec57d-0e4e-457a-bc99-53fc12434966', 'cb069b4c-e0f0-4bfe-965a-87ab10ed20cd'),
('736ec57d-0e4e-457a-bc99-53fc12434966', 'd0776043-16b3-4399-8439-eeddd58b52b0'),
('ab7be36c-86fe-4f15-b5b0-2d8bc7372564', '0c0c9808-a7a3-4569-8626-292a97143848'),
('ab7be36c-86fe-4f15-b5b0-2d8bc7372564', 'd0776043-16b3-4399-8439-eeddd58b52b0'),
('b217aada-66be-4388-b1cc-c2c59e22d2b8', '0c0c9808-a7a3-4569-8626-292a97143848'),
('b217aada-66be-4388-b1cc-c2c59e22d2b8', '39e59c5d-6470-424f-b96d-1082894c137a'),
('b217aada-66be-4388-b1cc-c2c59e22d2b8', 'b2c17a15-f18e-4b24-8071-94c2167d48b2'),
('b217aada-66be-4388-b1cc-c2c59e22d2b8', 'd0776043-16b3-4399-8439-eeddd58b52b0'),
('be770146-fbc6-4b42-8786-5bb7f47d0ebc', '0641ed4a-9e59-4668-9f08-0ce970407bd7'),
('be770146-fbc6-4b42-8786-5bb7f47d0ebc', '39e59c5d-6470-424f-b96d-1082894c137a'),
('be770146-fbc6-4b42-8786-5bb7f47d0ebc', '3b1442d5-ce9b-4b02-ac1f-aad79a2ed937'),
('be770146-fbc6-4b42-8786-5bb7f47d0ebc', '7bacdb89-a383-499e-84d3-3b38470e909d'),
('be770146-fbc6-4b42-8786-5bb7f47d0ebc', '8992f4e5-5adc-4318-9681-95641e59e9f9'),
('be770146-fbc6-4b42-8786-5bb7f47d0ebc', 'b2c17a15-f18e-4b24-8071-94c2167d48b2'),
('be770146-fbc6-4b42-8786-5bb7f47d0ebc', 'cb069b4c-e0f0-4bfe-965a-87ab10ed20cd'),
('be770146-fbc6-4b42-8786-5bb7f47d0ebc', 'd0776043-16b3-4399-8439-eeddd58b52b0'),
('f8b789f8-b5fd-4b17-9399-5f9316c4c4bc', '0641ed4a-9e59-4668-9f08-0ce970407bd7'),
('f8b789f8-b5fd-4b17-9399-5f9316c4c4bc', '388bfa97-01c9-4365-a9c0-1453076bb31a'),
('f8b789f8-b5fd-4b17-9399-5f9316c4c4bc', '39e59c5d-6470-424f-b96d-1082894c137a'),
('f8b789f8-b5fd-4b17-9399-5f9316c4c4bc', '40b16345-f1f5-4817-a55b-16e00016483a'),
('f8b789f8-b5fd-4b17-9399-5f9316c4c4bc', '47313973-228b-47cd-ae1e-c92519bf0d10'),
('f8b789f8-b5fd-4b17-9399-5f9316c4c4bc', '7bacdb89-a383-499e-84d3-3b38470e909d'),
('f8b789f8-b5fd-4b17-9399-5f9316c4c4bc', '8992f4e5-5adc-4318-9681-95641e59e9f9'),
('f8b789f8-b5fd-4b17-9399-5f9316c4c4bc', 'b2c17a15-f18e-4b24-8071-94c2167d48b2'),
('f8b789f8-b5fd-4b17-9399-5f9316c4c4bc', 'cb069b4c-e0f0-4bfe-965a-87ab10ed20cd'),
('f8b789f8-b5fd-4b17-9399-5f9316c4c4bc', 'd0776043-16b3-4399-8439-eeddd58b52b0');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `exercise`
--
ALTER TABLE `exercise`
  ADD PRIMARY KEY (`exerciseId`);

--
-- Indexes for table `exercise_progress`
--
ALTER TABLE `exercise_progress`
  ADD PRIMARY KEY (`exerciseProgressId`),
  ADD KEY `FK_0827a835a338d53cb3d85d04e07` (`exerciseId`);

--
-- Indexes for table `expense`
--
ALTER TABLE `expense`
  ADD PRIMARY KEY (`id`),
  ADD KEY `FK_37c767c79d4d57e6088b901c0f4` (`walletId`);

--
-- Indexes for table `expense_file`
--
ALTER TABLE `expense_file`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `reminder`
--
ALTER TABLE `reminder`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `timeline`
--
ALTER TABLE `timeline`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `timeline_files`
--
ALTER TABLE `timeline_files`
  ADD PRIMARY KEY (`id`),
  ADD KEY `FK_d3ba6efc73dd4a2b22a5d623cdc` (`timelineId`);

--
-- Indexes for table `timeline_todos`
--
ALTER TABLE `timeline_todos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `FK_9d1b6db0bbdfaa102a347f64957` (`timelineId`);

--
-- Indexes for table `tips`
--
ALTER TABLE `tips`
  ADD PRIMARY KEY (`tipId`),
  ADD KEY `FK_772e6d5a61bacde1b43e8127319` (`exerciseId`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `wallet`
--
ALTER TABLE `wallet`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `workout`
--
ALTER TABLE `workout`
  ADD PRIMARY KEY (`workoutId`);

--
-- Indexes for table `workout_exercises`
--
ALTER TABLE `workout_exercises`
  ADD PRIMARY KEY (`workoutWorkoutId`,`exerciseExerciseId`),
  ADD KEY `IDX_fd4240db193fbff42eac581a98` (`workoutWorkoutId`),
  ADD KEY `IDX_0c254d17083f2d5257d10832c8` (`exerciseExerciseId`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `exercise_progress`
--
ALTER TABLE `exercise_progress`
  ADD CONSTRAINT `FK_0827a835a338d53cb3d85d04e07` FOREIGN KEY (`exerciseId`) REFERENCES `exercise` (`exerciseId`);

--
-- Constraints for table `expense`
--
ALTER TABLE `expense`
  ADD CONSTRAINT `FK_37c767c79d4d57e6088b901c0f4` FOREIGN KEY (`walletId`) REFERENCES `wallet` (`id`);

--
-- Constraints for table `timeline_files`
--
ALTER TABLE `timeline_files`
  ADD CONSTRAINT `FK_d3ba6efc73dd4a2b22a5d623cdc` FOREIGN KEY (`timelineId`) REFERENCES `timeline` (`id`);

--
-- Constraints for table `timeline_todos`
--
ALTER TABLE `timeline_todos`
  ADD CONSTRAINT `FK_9d1b6db0bbdfaa102a347f64957` FOREIGN KEY (`timelineId`) REFERENCES `timeline` (`id`);

--
-- Constraints for table `tips`
--
ALTER TABLE `tips`
  ADD CONSTRAINT `FK_772e6d5a61bacde1b43e8127319` FOREIGN KEY (`exerciseId`) REFERENCES `exercise` (`exerciseId`);

--
-- Constraints for table `workout_exercises`
--
ALTER TABLE `workout_exercises`
  ADD CONSTRAINT `FK_0c254d17083f2d5257d10832c8a` FOREIGN KEY (`exerciseExerciseId`) REFERENCES `exercise` (`exerciseId`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `FK_fd4240db193fbff42eac581a98b` FOREIGN KEY (`workoutWorkoutId`) REFERENCES `workout` (`workoutId`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
