<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('conversions:prune')->everyFiveMinutes()->withoutOverlapping();
