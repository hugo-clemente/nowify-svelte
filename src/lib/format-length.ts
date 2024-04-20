const formatLength = (length: number): string => {
	// decomposing the length into hours, minutes, and seconds to display
	const hours = Math.floor(length / (60 * 60 * 1000));
	const minutes = Math.floor((length % (60 * 60 * 1000)) / (60 * 1000));
	const seconds = Math.floor((length % (60 * 1000)) / 1000);

	if (hours > 0)
		return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

	if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, '0')}`;

	return `0:${String(seconds).padStart(2, '0')}`;
};

export { formatLength };
