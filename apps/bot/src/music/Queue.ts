import type { Track } from "@discordbot/lavalink";

export interface QueueTrack {
  track: Track;
  requester: string;
  requesterId: string;
}

export interface HistoryTrack extends QueueTrack {
  playedAt: number;
}

export enum LoopMode {
  None = "none",
  Track = "track",
  Queue = "queue",
}

/**
 * Queue manager for a single guild
 */
export class Queue {
  public readonly guildId: string;
  public tracks: QueueTrack[] = [];
  public current: QueueTrack | null = null;
  public previous: QueueTrack | null = null;
  public history: HistoryTrack[] = [];
  public loopMode: LoopMode = LoopMode.None;
  public volume: number = 100;
  public textChannelId: string | null = null;
  public voiceChannelId: string | null = null;

  // Vote skip tracking
  public skipVotes: Set<string> = new Set();

  // Maximum history size
  private readonly maxHistorySize = 50;

  constructor(guildId: string) {
    this.guildId = guildId;
  }

  /**
   * Add a track to the queue
   */
  add(track: Track, requester: string, requesterId: string): void {
    this.tracks.push({ track, requester, requesterId });
  }

  /**
   * Add multiple tracks to the queue
   */
  addMany(tracks: Track[], requester: string, requesterId: string): void {
    for (const track of tracks) {
      this.tracks.push({ track, requester, requesterId });
    }
  }

  /**
   * Get the next track in the queue
   */
  next(): QueueTrack | null {
    // Handle loop modes
    if (this.loopMode === LoopMode.Track && this.current) {
      return this.current;
    }

    // Save current as previous
    if (this.current) {
      this.previous = this.current;
      
      // If queue loop, add current track back to end
      if (this.loopMode === LoopMode.Queue) {
        this.tracks.push(this.current);
      }
    }

    // Get next track
    this.current = this.tracks.shift() ?? null;
    return this.current;
  }

  /**
   * Skip to a specific position in the queue
   */
  skipTo(index: number): QueueTrack | null {
    if (index < 0 || index >= this.tracks.length) {
      return null;
    }

    // Remove tracks before the index
    this.tracks.splice(0, index);
    return this.next();
  }

  /**
   * Remove a track at a specific index
   */
  remove(index: number): QueueTrack | null {
    if (index < 0 || index >= this.tracks.length) {
      return null;
    }
    const [removed] = this.tracks.splice(index, 1);
    return removed ?? null;
  }

  /**
   * Shuffle the queue
   */
  shuffle(): void {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j]!, this.tracks[i]!];
    }
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.tracks = [];
  }

  /**
   * Get the total duration of the queue in milliseconds
   */
  get totalDuration(): number {
    let duration = this.current?.track.info.length ?? 0;
    for (const { track } of this.tracks) {
      duration += track.info.length;
    }
    return duration;
  }

  /**
   * Get the queue size
   */
  get size(): number {
    return this.tracks.length;
  }

  /**
   * Check if queue is empty
   */
  get isEmpty(): boolean {
    return this.tracks.length === 0 && this.current === null;
  }

  /**
   * Add current track to history
   */
  addToHistory(track: QueueTrack): void {
    const historyTrack: HistoryTrack = {
      ...track,
      playedAt: Date.now(),
    };
    
    this.history.unshift(historyTrack);
    
    // Trim history if too large
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get recent history
   */
  getHistory(limit: number = 10): HistoryTrack[] {
    return this.history.slice(0, limit);
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Move a track from one position to another
   */
  move(from: number, to: number): boolean {
    if (from < 0 || from >= this.tracks.length) return false;
    if (to < 0 || to >= this.tracks.length) return false;
    if (from === to) return true;

    const [track] = this.tracks.splice(from, 1);
    if (!track) return false;
    
    this.tracks.splice(to, 0, track);
    return true;
  }

  /**
   * Add a vote for skipping
   */
  addSkipVote(userId: string): number {
    this.skipVotes.add(userId);
    return this.skipVotes.size;
  }

  /**
   * Remove a skip vote
   */
  removeSkipVote(userId: string): void {
    this.skipVotes.delete(userId);
  }

  /**
   * Check if user has voted
   */
  hasVoted(userId: string): boolean {
    return this.skipVotes.has(userId);
  }

  /**
   * Clear skip votes (called when track changes)
   */
  clearSkipVotes(): void {
    this.skipVotes.clear();
  }

  /**
   * Get number of skip votes
   */
  get voteCount(): number {
    return this.skipVotes.size;
  }
}
