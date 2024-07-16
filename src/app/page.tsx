'use client';
import {Button, Container} from "react-bootstrap";
import {useEffect, useState} from "react";
import {getDistance} from 'geolib';
import {FaExpandAlt} from "react-icons/fa";

const paceMeasurementsDistance = 100;
const mPerSecondToKmPerHourConversionFactor = 3.6;
const paceMinimumTimeMs = 1000 * 20;
const currentTrackKey: string = "currentTrack";

interface Location {
    latitude: number;
    longitude: number;
    timestamp: number;
    speed: number;
    accuracy: number;
    distanceFromPreviousMeters: number;
    distanceToNextMeters: number;
}

class SavedTrack {
    public distance = 0;
    public startTime = 0;

    constructor(track: Track) {
        this.distance = track.getDistance();
        this.startTime = track.getStartTime();
    }
}

class Track {
    private locations: Location[] = [];
    private distance = 0;
    private currentTime = new Date().getTime();
    private startTime = new Date().getTime();

    public getStartTime() {
        return this.startTime;
    }

    public add(location: Location): boolean {
        this.currentTime = location.timestamp;
        const locationCount = this.locations.length;
        let previousPoint: Location | null = null;
        if (locationCount > 0) {
            previousPoint = this.locations[locationCount - 1]
        }
        if (previousPoint != null) {
            let distance = getDistance(location, previousPoint);
            if (distance < location.accuracy * 2) {
                return false
            }
            if (distance === undefined || distance === null) {
                return false;
            }
            this.distance += distance;
            location.distanceFromPreviousMeters = distance;
            previousPoint.distanceToNextMeters = distance;
        } else {
            location.distanceFromPreviousMeters = 0;
        }
        this.locations.push(location);
        return true;
    }

    public getDistance(): number {
        return this.distance;
    }

    public getPace(): number {
        const locationCount = this.locations.length;
        if (locationCount === 0) {
            return 0;
        }
        let totalDistanceMeters = 0;
        let i = locationCount
        for (; i > 1; i--) {
            let location = this.locations[i];
            if (location === undefined || location === null) {
                continue;
            }
            totalDistanceMeters += location.distanceToNextMeters;
            let timeDifference = this.currentTime - location.timestamp;
            let satisfiesDistance = totalDistanceMeters > paceMeasurementsDistance;
            let satisfiesTime = timeDifference > paceMinimumTimeMs;
            if (satisfiesDistance && satisfiesTime) {
                break;
            }
        }
        if (i === locationCount) {
            return 0;
        }
        let firstLocation = this.locations[i];
        let timeDifferenceSeconds = (this.currentTime - firstLocation.timestamp) / 1000.0;
        if (timeDifferenceSeconds === 0) {
            return 0;
        }
        let averageSpeedMetersPerSecond = totalDistanceMeters / timeDifferenceSeconds;
        return averageSpeedMetersPerSecond * mPerSecondToKmPerHourConversionFactor;
    }

    public getDurationMs() {
        return this.currentTime - this.startTime;
    }

    public reset(): void {
        this.locations = [];
        this.distance = 0;
        let now = new Date().getTime();
        this.startTime = now;
        this.currentTime = now;
    }

    public setDistance(distance: number) {
        this.distance = distance;
    }

    public setStarttime(startTime: number) {
        this.startTime = startTime;
        this.updateCurrentTime();
    }

    public updateCurrentTime() {
        this.currentTime = new Date().getTime();
    }
}

function formatDuration(ms: number): string {
    if (typeof ms !== 'number' || ms < 0) {
        throw new Error('Duration must be a non-negative number');
    }
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const pad = (num: number): string => num.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatNumber(value: number, numberOfDecimals: number) {
    return new Intl.NumberFormat('da-DK', {
        minimumFractionDigits: numberOfDecimals,
        maximumFractionDigits: numberOfDecimals,
    }).format(value);
}

function save(track: Track): void {
    let savedTrack = new SavedTrack(track);
    localStorage.setItem(currentTrackKey, JSON.stringify(savedTrack));
}

function reload(track: Track) {
    let loadedItem = localStorage.getItem(currentTrackKey);
    if (loadedItem !== null) {
        try {
            let parsedObject = JSON.parse(loadedItem)
            track.setDistance(parsedObject.distance)
            track.setStarttime(parsedObject.startTime)
        } catch (error) {
            console.log(error);
        }
    }
}

export default function Home() {
    const [track, setTrack] = useState(new Track())
    const [distanceMeters, setDistanceMeters] = useState<number>(0);
    const [gpsError, setGpsError] = useState<string | null>(null);
    const [pace, setPace] = useState(0);
    const [fullscreen, setFullscreen] = useState(false);
    const [durationMs, setDurationMs] = useState(0)


    useEffect(() => {
        setInterval(() => {
            track.updateCurrentTime();
            setPace(track.getPace());
            setDurationMs(track.getDurationMs());
        }, 500);
    }, [track])

    useEffect(() => {
        document.addEventListener('fullscreenchange', () => {
            setFullscreen(document.fullscreenElement != null);
        });
    }, []);

    useEffect(() => {
        reload(track);
        setDurationMs(track.getDurationMs());
        setDistanceMeters(track.getDistance());
        if (navigator.geolocation) {
            navigator.geolocation.watchPosition(
                (position) => {
                    if (position.coords.accuracy > 20) {
                        return;
                    }
                    let location = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        timestamp: new Date().getTime(),
                        speed: position.coords.speed ?? 0,
                        accuracy: position.coords.accuracy,
                        distanceToNextMeters: 0,
                        distanceFromPreviousMeters: 0,
                    };
                    if (track.add(location)) {
                        setDistanceMeters(track.getDistance());
                        setPace(track.getPace());
                        save(track);
                    }
                    setDurationMs(track.getDurationMs())
                },
                (error) => {
                    setGpsError(error.message);
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 1000, // positions returned to us, must be at most 10 second old
                }
            );
        } else {
            setGpsError('Geolocation is not supported by this browser.');
        }
    }, [track]);


    if (gpsError !== null) {
        return <Container>
            <h1>No GPS access</h1>
        </Container>
    }

    return (
        <>
            <Container className="dashboard d-flex justify-content-center">
                {formatNumber(distanceMeters / 1000, 2)} km
            </Container>
            <Container className="dashboard d-flex justify-content-center">
                {formatNumber(pace, 1)} km/h
            </Container>
            <Container className="dashboard d-flex justify-content-center time">
                {formatDuration(durationMs)}
            </Container>

            <Container className="d-flex justify-content-center">
                <Button hidden={fullscreen} variant="primary" onClick={() => {
                    let wakeLock = navigator.wakeLock.request('screen');
                    document.documentElement.requestFullscreen()
                }}><FaExpandAlt size={50}/></Button>
            </Container>

            <Container>
                <Button hidden={fullscreen} className="bottom-button" onClick={() => {
                    track.reset();
                    setDistanceMeters(0);
                    setPace(0);
                    setDurationMs(0)
                    save(track);
                }}>Reset Track</Button>
            </Container>
        </>
    );
}
